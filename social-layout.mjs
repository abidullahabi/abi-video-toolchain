// Conservative local production profile, based on the supplied TikTok UI screenshot.
// This is not a universal platform guarantee. Keep actual-device review in the workflow.
export const SOCIAL_LAYOUT = Object.freeze({
  width:1080, height:1920, centerX:540,
  safeLeft:180, safeRight:900, safeTop:300, safeBottom:1500,
  textWidth:720, captionMaxWidth:684, captionFontSize:56, captionTop:1280, captionMaxWords:3,
});
// Only for projects explicitly calibrated against DESIGN.md 1.9. Historical projects keep their original profile.
export const DESIGN19_LAYOUT = Object.freeze({
  width:1080,height:1920,centerX:510,safeLeft:90,safeRight:930,safeTop:250,safeBottom:1660,
  textWidth:840,captionMaxWidth:620,captionFontSize:56,captionTop:1280,captionMaxWords:4,
});
export const layoutFor = plan => plan.designVersion === '1.9' ? DESIGN19_LAYOUT : SOCIAL_LAYOUT;
export function boxViolations(box, {stroke=0, centered=true}={}) {
  const p=stroke/2, issues=[];
  if(box.x-p<SOCIAL_LAYOUT.safeLeft-0.1 || box.x+box.width+p>SOCIAL_LAYOUT.safeRight+0.1 || box.y-p<SOCIAL_LAYOUT.safeTop-0.1 || box.y+box.height+p>SOCIAL_LAYOUT.safeBottom+0.1)issues.push('danger_zone');
  if(centered && Math.abs(box.x+box.width/2-SOCIAL_LAYOUT.centerX)>0.6)issues.push('not_centered');
  return issues;
}
