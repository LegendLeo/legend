import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'

type Phase = 'idle' | 'requesting' | 'loading' | 'tracking' | 'error'
type Stage = 'camera' | 'playback' | 'model' | 'tracking'
type CameraIssue = { title: string; hint: string; code: string }

function describeIssue(error: unknown, stage: Stage): CameraIssue {
  const code = error && typeof error === 'object' && 'name' in error ? String(error.name) : 'UnknownError'
  if (stage === 'model' || stage === 'tracking') {
    return { title: stage === 'model' ? '手势模型加载失败' : '手部跟踪已停止', hint: '摄像头已释放。点击重试以重新加载本地手势模型。', code }
  }
  switch (code) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return { title: '摄像头访问被阻止', hint: '请在网站权限和 Windows 相机隐私设置中允许访问摄像头，然后重试。', code }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { title: '未检测到摄像头', hint: '请连接或启用摄像头，然后重试。', code }
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return { title: '摄像头未能启动', hint: '请关闭其他使用摄像头的网页或视频应用，然后重试，并检查设备和 Windows 相机设置。', code }
    case 'OverconstrainedError':
      return { title: '摄像头不支持当前采集设置', hint: '请检查所选摄像头及其驱动程序，然后重试。', code }
    case 'InsecureContext':
      return { title: '需要安全连接', hint: '请通过 localhost 本地地址或 HTTPS 打开此页面。', code }
    case 'UnsupportedBrowser':
      return { title: '当前浏览器不支持摄像头访问', hint: '请在 Chrome 或 Edge 中打开此页面的 localhost 本地地址。', code }
    case 'CameraDisconnected':
      return { title: '摄像头连接已断开', hint: '请重新连接摄像头或恢复设备访问权限，然后重试。', code }
    default:
      return { title: stage === 'playback' ? '摄像头预览已停止' : '摄像头启动失败', hint: '请重试采集；若问题仍然存在，请检查摄像头设备。', code }
  }
}

export function useCameraSession(
  videoRef: RefObject<HTMLVideoElement>,
  enabled: boolean,
  attempt: number,
  onFrame: (result: HandLandmarkerResult) => void,
) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [issue, setIssue] = useState<CameraIssue | null>(null)
  // getUserMedia has no abort API. A new attempt waits for the previous one to release its resources.
  const startupQueue = useRef<Promise<void>>(Promise.resolve())
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let detector: HandLandmarker | null = null
    let raf = 0
    let stage: Stage = 'camera'
    const video = videoRef.current

    const release = () => {
      cancelAnimationFrame(raf)
      const ownedStream = stream
      stream = null
      ownedStream?.getTracks().forEach((track) => track.stop())
      if (video && ownedStream && video.srcObject === ownedStream) {
        video.pause()
        video.srcObject = null
      }
      const ownedDetector = detector
      detector = null
      if (ownedDetector) {
        try { ownedDetector.close() } catch (error) { console.warn('Hand detector cleanup failed', error) }
      }
    }

    const fail = (error: unknown) => {
      release()
      if (cancelled) return
      cancelled = true
      console.warn(`Camera session failed during ${stage}`, error)
      setIssue(describeIssue(error, stage))
      setPhase('error')
    }

    const start = async () => {
      if (cancelled) return
      try {
        if (!window.isSecureContext) throw new DOMException('', 'InsecureContext')
        if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('', 'UnsupportedBrowser')
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 }, facingMode: { ideal: 'user' } },
          audio: false,
        })
        if (cancelled) { release(); return }
        stream.getVideoTracks().forEach((track) => track.addEventListener('ended', () => {
          stage = 'camera'
          fail(new DOMException('', 'CameraDisconnected'))
        }, { once: true }))
        stage = 'playback'
        if (!video) throw new Error('Video element missing')
        video.srcObject = stream
        await video.play()
        if (cancelled) { release(); return }

        stage = 'model'
        setPhase('loading')
        const assetBase = import.meta.env.BASE_URL
        const vision = await FilesetResolver.forVisionTasks(`${assetBase}wasm`)
        if (cancelled) { release(); return }
        const options = {
          // Keep inference off the GPU shared with Three.js.
          baseOptions: { modelAssetPath: `${assetBase}models/hand_landmarker.task`, delegate: 'CPU' as const },
          runningMode: 'VIDEO' as const,
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }
        detector = await HandLandmarker.createFromOptions(vision, options)
        if (cancelled) { release(); return }
        stage = 'tracking'
        setPhase('tracking')
        let lastVideoTime = -1
        let lastInferenceTime = -Infinity
        const loop = (now: number) => {
          if (cancelled || !detector) return
          try {
            if (video.readyState >= 2 && video.currentTime !== lastVideoTime && now - lastInferenceTime >= 50) {
              lastVideoTime = video.currentTime
              lastInferenceTime = now
              onFrameRef.current(detector.detectForVideo(video, now))
            }
          } catch (error) { fail(error); return }
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
      } catch (error) { fail(error) }
    }

    setIssue(null)
    setPhase(enabled ? 'requesting' : 'idle')
    if (enabled) startupQueue.current = startupQueue.current.then(start, start)
    const onPageHide = () => { cancelled = true; release() }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && enabled) {
        setIssue({ title: '摄像头会话已结束', hint: '请点击重试以重新连接摄像头。', code: 'PageRestored' })
        setPhase('error')
      }
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      cancelled = true
      release()
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [enabled, attempt, videoRef])

  return { phase, issue }
}
