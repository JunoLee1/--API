import { validateVideoUrl } from '../../src/prospect/video-url.validator'

describe('validateVideoUrl', () => {
  it('유효한 https URL은 통과', () => {
    expect(() => validateVideoUrl('https://cdn.example.com/match.mp4')).not.toThrow()
  })

  it('http URL도 통과', () => {
    expect(() => validateVideoUrl('http://cdn.example.com/video.mp4')).not.toThrow()
  })

  it('https/http 외 스킴 차단 (ftp)', () => {
    expect(() => validateVideoUrl('ftp://cdn.example.com/video.mp4')).toThrow('INVALID_VIDEO_URL')
  })

  it('빈 문자열 차단', () => {
    expect(() => validateVideoUrl('')).toThrow('INVALID_VIDEO_URL')
  })

  it('URL 형식 아닌 문자열 차단', () => {
    expect(() => validateVideoUrl('not-a-url')).toThrow('INVALID_VIDEO_URL')
  })

  it('비디오 확장자 아닌 URL 차단 (.exe)', () => {
    expect(() => validateVideoUrl('https://cdn.example.com/malware.exe')).toThrow('INVALID_VIDEO_URL')
  })

  it('YouTube URL 통과', () => {
    expect(() => validateVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).not.toThrow()
  })

  it('youtu.be 단축 URL 통과', () => {
    expect(() => validateVideoUrl('https://youtu.be/dQw4w9WgXcQ')).not.toThrow()
  })

  it('확장자 없는 일반 URL 차단', () => {
    expect(() => validateVideoUrl('https://example.com/some-page')).toThrow('INVALID_VIDEO_URL')
  })

  describe('SSRF 차단 (production 환경)', () => {
    const originalEnv = process.env['NODE_ENV']
    beforeEach(() => { process.env['NODE_ENV'] = 'production' })
    afterEach(() => { process.env['NODE_ENV'] = originalEnv })

    it('localhost 차단', () => {
      expect(() => validateVideoUrl('http://localhost:3000/internal/secret')).toThrow('SSRF_BLOCKED')
    })

    it('127.0.0.1 차단', () => {
      expect(() => validateVideoUrl('http://127.0.0.1/admin')).toThrow('SSRF_BLOCKED')
    })

    it('10.x.x.x 사설 IP 차단', () => {
      expect(() => validateVideoUrl('http://10.0.0.1/video.mp4')).toThrow('SSRF_BLOCKED')
    })

    it('172.16~31.x.x 사설 IP 차단', () => {
      expect(() => validateVideoUrl('http://172.20.0.5/video.mp4')).toThrow('SSRF_BLOCKED')
    })

    it('192.168.x.x 사설 IP 차단', () => {
      expect(() => validateVideoUrl('http://192.168.1.100/clip.mp4')).toThrow('SSRF_BLOCKED')
    })

    it('AWS metadata endpoint 차단 (169.254.x.x)', () => {
      expect(() => validateVideoUrl('http://169.254.169.254/latest/meta-data')).toThrow('SSRF_BLOCKED')
    })
  })

  describe('localhost 허용 (개발 환경)', () => {
    const originalEnv = process.env['NODE_ENV']
    beforeEach(() => { process.env['NODE_ENV'] = 'development' })
    afterEach(() => { process.env['NODE_ENV'] = originalEnv })

    it('localhost mp4 허용', () => {
      expect(() => validateVideoUrl('http://localhost:8080/match.mp4')).not.toThrow()
    })
  })
})
