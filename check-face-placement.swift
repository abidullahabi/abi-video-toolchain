import Foundation
import AVFoundation
import Vision

let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])
let asset = AVURLAsset(url: input)
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.maximumSize = CGSize(width: 540, height: 960)
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
let duration = CMTimeGetSeconds(asset.duration)
var samples: [[String: Any]] = []
for tick in 0..<Int(duration * 2) {
    let time = Double(tick) / 2
    do {
        let frame = try generator.copyCGImage(at: CMTime(seconds: time, preferredTimescale: 30), actualTime: nil)
        let request = VNDetectFaceRectanglesRequest()
        try VNImageRequestHandler(cgImage: frame).perform([request])
        let faces = (request.results ?? []).map { face -> [String: Double] in
            let b = face.boundingBox
            return ["x": b.minX * 1080, "y": (1 - b.maxY) * 1920, "width": b.width * 1080, "height": b.height * 1920]
        }
        samples.append(["time": time, "faces": faces])
    } catch {
        samples.append(["time": time, "error": error.localizedDescription])
    }
}
try JSONSerialization.data(withJSONObject: samples, options: [.prettyPrinted, .sortedKeys]).write(to: output)
print("Gesichtspositionen in \(samples.count) Stichproben geprüft.")
