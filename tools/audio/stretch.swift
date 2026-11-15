// 음 높이는 그대로 두고 속도만 늦춰요. 사용: swift stretch.swift 입력.m4a 출력.caf 0.7
// eleven_v3가 speed 설정을 무시해서, 보통 속도 파일로 천천히 듣기 파일을 만들 때 써요.
import AVFoundation

let a = CommandLine.arguments
let input = try AVAudioFile(forReading: URL(fileURLWithPath: a[1]))
let rate = Float(a[3]) ?? 0.7
let fmt = input.processingFormat
let engine = AVAudioEngine(), player = AVAudioPlayerNode(), tp = AVAudioUnitTimePitch()
tp.rate = rate
engine.attach(player); engine.attach(tp)
engine.connect(player, to: tp, format: fmt)
engine.connect(tp, to: engine.mainMixerNode, format: fmt)
try engine.enableManualRenderingMode(.offline, format: fmt, maximumFrameCount: 4096)
try engine.start()
player.scheduleFile(input, at: nil)
player.play()
let out = try AVAudioFile(forWriting: URL(fileURLWithPath: a[2]), settings: fmt.settings)
let buf = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: 4096)!
let total = AVAudioFramePosition(Double(input.length) / Double(rate)) + 2400  // 끝이 잘리지 않게 0.05초 여유
while engine.manualRenderingSampleTime < total {
  let n = min(AVAudioFrameCount(total - engine.manualRenderingSampleTime), 4096)
  guard try engine.renderOffline(n, to: buf) == .success else { break }
  try out.write(from: buf)
}
