/* Door sizing for quote preparation. Nominal slab, assembled unit, and framed
 * rough opening are different dimensions. Presets are estimates, not product
 * approvals; retain manual entry for supplier-confirmed dimensions.
 * Sources checked 2026-09-24:
 * https://bhidoors.com/wp-content/uploads/2022/11/BHI_UNITSIZE.pdf (exterior units)
 * https://learn.reeb.com/knowledge-base/unit-dimensions-and-rough-openings/
 *   (exterior installation allowance: +3/4 W, +1/2 H over unit)
 * https://evrodoors.com/measure (interior planning RO: +2 W, +2.5 H)
 * Interior unit estimates allow 1/2 inch total fitting space inside that RO.
 */
(function () {
  'use strict';
  var profiles = {
    interior: {label:'Interior prehung — estimate', single:1.5, double:1.5, height:2, gapW:0.5, gapH:0.5, swing:'N/A'},
    interiorAstragal: {label:'Interior pair with astragal — estimate', single:1.5, double:2, height:2, gapW:0.5, gapH:0.5, swing:'N/A'},
    exteriorIn: {label:'Exterior inswing — BHI frame estimate', single:1.5, double:2.125, height:2, gapW:0.75, gapH:0.5, swing:'In-Swing'},
    exteriorOut: {label:'Exterior outswing — BHI frame estimate', single:1.5, double:2.125, height:0.625, gapW:0.75, gapH:0.5, swing:'Out-Swing'}
  };
  var states = {};
  function el(id) { return document.getElementById(id); }
  function fraction(n) {
    var whole=Math.floor(n), eighths=Math.round((n-whole)*8);
    var f=['','1/8','1/4','3/8','1/2','5/8','3/4','7/8'];
    return String(whole)+(eighths?' '+f[eighths]:'');
  }
  function dim(w,h) { return fraction(w)+' x '+fraction(h); }
  function feet(n) { return Math.floor(n/12)+'/'+(n%12); }
  function rows(profile) {
    var p=profiles[profile]; if(!p) return [];
    var widths=profile==='interiorAstragal'?[48,56,60,64,68,72]:[24,28,30,32,34,36,48,56,60,64,68,72];
    return widths.flatMap(function(w){return [80,96].map(function(h){
      var nw=w+(w>36?p.double:p.single), nh=h+p.height;
      return {key:w+'-'+h, nominal:dim(w,h), net:dim(nw,nh), rough:dim(nw+p.gapW,nh+p.gapH),
        label:feet(w)+' x '+feet(h)+' — '+dim(w,h)+' in'+(w>36?' pair ('+(w/2)+' + '+(w/2)+')':' single')};
    });});
  }
  function option(value,label){var o=document.createElement('option');o.value=value;o.textContent=label;return o;}
  function populate(select, items, field) {
    select.replaceChildren(option('', '— Select standard size —'));
    items.forEach(function(r){select.appendChild(option(r.key,field==='label'?r.label:r[field]+' in — '+feet(+r.key.split('-')[0])+' x '+feet(+r.key.split('-')[1])));});
    select.appendChild(option('custom','Custom / supplier-confirmed'));
  }
  function refill(prefix) {
    var s=states[prefix], items=rows(s.profile.value);
    populate(s.nominal,items,'label'); populate(s.netPick,items,'net'); populate(s.roughPick,items,'rough');
    s.nominal.disabled=s.netPick.disabled=s.roughPick.disabled=!items.length;
  }
  function setPair(prefix,key) {
    var s=states[prefix], r=rows(s.profile.value).find(function(x){return x.key===key;});
    if(!r){s.nominal.value=s.netPick.value=s.roughPick.value=key; s.key=''; return;}
    s.key=r.key; s.nominal.value=s.netPick.value=s.roughPick.value=r.key;
    el(prefix+'-net-size').value=r.net; el(prefix+'-rough-opening').value=r.rough;
  }
  function parseNumber(s) {
    s=s.trim().replace(/-/g,' '); var m=s.match(/^(\d+)(?:\s+(\d+)\/(\d+))?$/);
    if(m) return +m[1]+(m[2]?+m[2]/+m[3]:0);
    return /^\d+(?:\.\d+)?$/.test(s)?+s:NaN;
  }
  function normalized(value) {
    var parts=value.toLowerCase().replace(/[″"]/g,'').replace(/\s*in(?:ches)?\s*/g,'').split(/x|×/);
    return parts.length===2?parts.map(parseNumber).join('x'):'';
  }
  function manual(prefix,side) {
    var s=states[prefix], value=el(prefix+(side==='net'?'-net-size':'-rough-opening')).value;
    var match=rows(s.profile.value).find(function(r){return normalized(r[side])===normalized(value);});
    if(match) setPair(prefix,match.key);
    else {s.key=''; s.nominal.value=s.netPick.value=s.roughPick.value='custom';}
  }
  function init(prefix) {
    var net=el(prefix+'-net-size'), rough=el(prefix+'-rough-opening'); if(!net||!rough)return;
    var row=rough.parentElement.parentElement;
    var panel=document.createElement('div');panel.style.cssText='margin-bottom:10px;';
    var label=document.createElement('label');label.className='lbl';label.htmlFor=prefix+'-size-profile';label.textContent='Prehung sizing guide';
    var profile=document.createElement('select');profile.id=label.htmlFor;profile.style.cssText='width:100%;margin-bottom:8px';
    profile.appendChild(option('','— Choose interior or exterior —'));
    Object.keys(profiles).forEach(function(k){profile.appendChild(option(k,profiles[k].label));});
    var nominalLabel=document.createElement('label');nominalLabel.className='lbl';nominalLabel.htmlFor=prefix+'-nominal-size';nominalLabel.textContent='Door size (nominal slab / combined pair)';
    var nominal=document.createElement('select');nominal.id=nominalLabel.htmlFor;nominal.style.width='100%';
    panel.append(label,profile,nominalLabel,nominal);row.before(panel);
    function picker(input,field,title){
      var l=input.parentElement.querySelector('label');l.textContent=title;l.htmlFor=prefix+'-'+field+'-preset';
      var select=document.createElement('select');select.id=l.htmlFor;select.style.cssText='width:100%;margin-bottom:6px';input.before(select);
      input.setAttribute('aria-label',title+' — edit inches');input.placeholder='Width x height, inches';return select;
    }
    var netPick=picker(net,'net','Net unit size (outside frame)'), roughPick=picker(rough,'rough','Rough opening (framing)');
    var note=document.createElement('div');note.style.cssText='font-size:12px;line-height:1.45;color:#6b5a3a;margin-bottom:12px';
    note.textContent='Sizing estimates in inches. Door size excludes the frame; net unit includes it; rough opening includes fitting space. Confirm supplier dimensions, sill, astragal and floor allowance before ordering. Custom entries remain editable.';
    row.after(note);
    states[prefix]={profile:profile,nominal:nominal,netPick:netPick,roughPick:roughPick,key:''};refill(prefix);
    profile.addEventListener('change',function(){var key=states[prefix].key;refill(prefix);setPair(prefix,key);if(profiles[profile.value])el(prefix+'-swing').value=profiles[profile.value].swing;});
    [nominal,netPick,roughPick].forEach(function(pick){pick.addEventListener('change',function(){setPair(prefix,pick.value);});});
    net.addEventListener('change',function(){manual(prefix,'net');});rough.addEventListener('change',function(){manual(prefix,'rough');});
    el(prefix+'-swing').addEventListener('change',function(){
      if(!/^exterior/.test(profile.value))return;
      var swing=this.value;if(swing==='In-Swing'||swing==='Out-Swing'){profile.value=swing==='In-Swing'?'exteriorIn':'exteriorOut';var key=states[prefix].key;refill(prefix);setPair(prefix,key);}
    });
  }
  window.nsDoorSizingLoad=function(prefix,spec){
    var s=states[prefix];if(!s)return;spec=spec||{};s.profile.value=spec.sizingProfile||'';s.key='';refill(prefix);
    // Loading an existing quote must never recalculate or replace saved dimensions.
    var match=rows(s.profile.value).find(function(r){return r.net===spec.netSize&&r.rough===spec.roughOpening;});
    s.key=match?match.key:'';s.nominal.value=s.netPick.value=s.roughPick.value=match?match.key:(spec.netSize||spec.roughOpening?'custom':'');
  };
  window.nsDoorSizingRead=function(prefix){
    var s=states[prefix];if(!s||!s.key)return {};
    var r=rows(s.profile.value).find(function(x){return x.key===s.key;});
    if(!r||el(prefix+'-net-size').value!==r.net||el(prefix+'-rough-opening').value!==r.rough)return {};
    return {nominalSize:r.nominal,sizingProfile:s.profile.value,sizingEstimate:true};
  };
  ['ds','ci','sod'].forEach(init);
  // Exposed for deterministic conversion tests, without touching quote data.
  window.nsDoorSizeRows=rows;
})();
