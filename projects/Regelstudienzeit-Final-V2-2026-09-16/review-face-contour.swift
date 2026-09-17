import Foundation
import AVFoundation
import Vision
let input=URL(fileURLWithPath:CommandLine.arguments[1])
let output=URL(fileURLWithPath:CommandLine.arguments[2])
let asset=AVURLAsset(url:input)
let generator=AVAssetImageGenerator(asset:asset)
generator.appliesPreferredTrackTransform=true
generator.maximumSize=CGSize(width:540,height:960)
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
var samples:[[String:Any]]=[]
for tick in 0..<Int(CMTimeGetSeconds(asset.duration)*2){
 let time=Double(tick)/2
 do{
  let frame=try generator.copyCGImage(at:CMTime(seconds:time,preferredTimescale:30),actualTime:nil)
  let request=VNDetectFaceLandmarksRequest()
  try VNImageRequestHandler(cgImage:frame).perform([request])
  let faces=(request.results ?? []).map {face -> [String:Any] in
   let b=face.boundingBox
   let raw:[String:Double]=["x":b.minX*1080,"y":(1-b.maxY)*1920,"width":b.width*1080,"height":b.height*1920]
   guard let contour=face.landmarks?.faceContour,contour.pointCount>0 else{return raw.merging(["landmarkFallback":1]){a,_ in a}}
   let points=contour.normalizedPoints.map{p in ["x":(b.minX+Double(p.x)*b.width)*1080,"y":(1-b.minY-Double(p.y)*b.height)*1920]}
   let lowest=(points.map{$0["y"]!}.max() ?? (raw["y"]!+raw["height"]!))+12
   return ["x":raw["x"]!,"y":raw["y"]!,"width":raw["width"]!,"height":max(raw["height"]!*0.6,lowest-raw["y"]!),"rawBoundingBox":raw,"contour":points,"protectionBasis":"Full detected width and forehead, measured chin contour plus 12 pixels. Exclude only neck below actual chin."]
  }
  samples.append(["time":time,"faces":faces])
 }catch{samples.append(["time":time,"error":error.localizedDescription])}
}
try JSONSerialization.data(withJSONObject:samples,options:[.prettyPrinted,.sortedKeys]).write(to:output)
print("Konturen in \(samples.count) Bildern geprüft.")
