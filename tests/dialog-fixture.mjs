// jsdom does not implement the native dialog methods used by browsers.
export function installDialog(dom) {
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 dom.window.HTMLDialogElement.prototype.close=function(){
  if(!this.open)return;
  this.removeAttribute('open');
  this.dispatchEvent(new dom.window.Event('close'));
 };
}
