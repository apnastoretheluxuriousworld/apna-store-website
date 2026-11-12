// Plain module (not "use client"): the root layout inlines this string into <head>.
/**
 * Runs in <head> before anything is drawn. First page load of this tab: remember
 * it and remove the splash after it has played (so a later remount of the store
 * layout, e.g. after visiting the admin, doesn't replay it). Every later load:
 * hide the splash straight away. Never for the admin panel.
 */
export const SPLASH_GATE = `(function(){try{
if(location.pathname.indexOf('/admin')===0)return;
var d=document,k='as-splash',hide=function(){var s=d.createElement('style');s.textContent='.brand-splash{display:none!important}';d.head.appendChild(s)};
if(sessionStorage.getItem(k)){hide();return}
sessionStorage.setItem(k,'1');setTimeout(hide,2500)
}catch(e){}})()`;
