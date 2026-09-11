import { AppError } from '../lib/AppError'

const ALLOWED_SCHEMES = ['http:', 'https:']

const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.wmv', '.flv', '.ts', '.m3u8']

// 영상 스트리밍 서비스 도메인 — 확장자 없어도 허용
const STREAMING_DOMAINS = [
  /youtube\.com$/i,
  /youtu\.be$/i,
  /vimeo\.com$/i,
]

// RFC 1918 사설 IP + 링크-로컬 (SSRF 차단 대상)
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/,  // AWS metadata, link-local
  /^::1$/,                  // IPv6 loopback
  /^fc00:/i,                // IPv6 ULA
]

export function validateVideoUrl(url: string): void {
  const isProduction = process.env['NODE_ENV'] === 'production'
  if (!url) throw new AppError(400, 'INVALID_VIDEO_URL')

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new AppError(400, 'INVALID_VIDEO_URL')
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    throw new AppError(400, 'INVALID_VIDEO_URL')
  }

  // 개발 환경에서는 localhost 허용 (로컬 테스트용)
  if (isProduction) {
    const hostname = parsed.hostname.toLowerCase()
    if (PRIVATE_IP_PATTERNS.some(p => p.test(hostname))) {
      throw new AppError(400, 'SSRF_BLOCKED')
    }
  }

  const hostname = parsed.hostname.toLowerCase()
  const path = parsed.pathname.toLowerCase()

  const isStreamingDomain = STREAMING_DOMAINS.some(p => p.test(hostname))
  const hasVideoExt = ALLOWED_VIDEO_EXTENSIONS.some(ext => path.endsWith(ext))
  const hasQueryStream = parsed.searchParams.has('format') || parsed.searchParams.has('mime')

  if (!isStreamingDomain && !hasVideoExt && !hasQueryStream) {
    throw new AppError(400, 'INVALID_VIDEO_URL')
  }
}
