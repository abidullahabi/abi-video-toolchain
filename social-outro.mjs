// Confirmed by Abdullah on 14 September 2026. All profiles appear together.
export const SOCIAL_PROFILES = Object.freeze([
  {platform:'YouTube',name:'@itsabidullahabi',src:'assets/youtube-icon.png'},
  {platform:'TikTok',name:'@abidullahabi',src:'assets/tiktok-icon.png'},
  {platform:'Instagram',name:'@abidullahabi',src:'assets/instagram-icon.png'},
  {platform:'LinkedIn',name:'Abdullah Bachtari',src:'assets/linkedin-in-blue.png'},
]);
export function buildSocialOutro(start,end){
  if(!(start>=0&&end>start))throw Error('Outro-Zeiten fehlen.');
  const time={start,end};
  return {
    sections:[
      {id:'outro-road',...time,text:'Road to 10K',fontSize:60,top:310},
      {id:'outro-folgen',...time,text:'Folgen nicht vergessen',fontSize:44,top:494,background:'#e53935'},
    ],
    overlays:[{id:'outro-fragen',...time,kind:'support',lines:['Bei Fragen einen','Kommentar oder DM schreiben'],fontSize:34,top:409}],
    socialCtas:[{id:'outro-socials',...time,kind:'social-cta',top:1374,width:700,height:116,profiles:SOCIAL_PROFILES.map(x=>({...x})),layout:'profiles-grid'}],
    outroGroup:{...time,ids:['outro-road','outro-folgen','outro-fragen','outro-socials'],simultaneousProfiles:true,profileCount:4},
  };
}
