import { Config } from '@remotion/cli/config'

// 글자 가장자리가 뭉개지지 않게 프레임은 PNG로 찍고, 화질 위주로 인코딩한다
Config.setVideoImageFormat('png')
Config.setCodec('h264')
Config.setCrf(16)
Config.setPixelFormat('yuv420p')
