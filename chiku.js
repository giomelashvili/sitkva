// Chiku — the app companion. Animated SVG bird, reacts to taps.
const NS = 'http://www.w3.org/2000/svg';

export function createChiku({ size = 180, mood = 'wave', motion = true, onTap } = {}) {
  const btn = document.createElement('button');
  btn.setAttribute('aria-label', 'ჭიკუ, აპის პატარა ჩიტი. შეეხე და გაგეხმაურება');
  btn.style.width = size + 'px'; btn.style.height = size + 'px'; btn.style.position = 'relative';
  btn.className = 'chiku';
  btn.innerHTML = '<div class="chirp hidden">ჭიკ-ჭიკ!</div>' + svgFor(mood, motion);
  const chirp = btn.querySelector('.chirp');
  let timer = null;
  btn.addEventListener('click', () => {
    btn.classList.add('hop');
    chirp.classList.remove('hidden');
    btn.querySelector('.chiku-body').classList.add('happy');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { chirp.classList.add('hidden'); btn.classList.remove('hop'); btn.querySelector('.chiku-body').classList.remove('happy'); }, 1400);
    if (onTap) onTap();
  });
  return btn;
}

export function svgFor(mood = 'wave', motion = true) {
  const anim = motion;
  const bob = anim ? '<animateTransform attributeName="transform" type="translate" values="0 0; 0 -4; 0 0" dur="2.4s" repeatCount="indefinite"/>' : '';
  const blink = anim ? '<animate attributeName="ry" values="17;17;2;17;17" keyTimes="0;0.88;0.92;0.96;1" dur="4.2s" repeatCount="indefinite"/>' : '';
  const pblink = anim ? '<animate attributeName="ry" values="9;9;1;9;9" keyTimes="0;0.88;0.92;0.96;1" dur="4.2s" repeatCount="indefinite"/>' : '';
  const lwing = anim ? '<animateTransform attributeName="transform" type="rotate" values="18 34 122; 8 34 122; 18 34 122" dur="2.6s" repeatCount="indefinite"/>' : '';
  let right = '';
  if (mood === 'wave') right = `<ellipse cx="168" cy="72" rx="15" ry="28" fill="#3C9BB0">${anim ? '<animateTransform attributeName="transform" type="rotate" values="35 168 100; 62 168 100; 35 168 100" dur="1.1s" repeatCount="indefinite"/>' : ''}</ellipse>`;
  else if (mood === 'point') right = `<ellipse cx="178" cy="108" rx="32" ry="14" fill="#3C9BB0">${anim ? '<animateTransform attributeName="transform" type="translate" values="0 0; 10 0; 0 0" dur="1.2s" repeatCount="indefinite"/>' : ''}</ellipse>`;
  else right = `<ellipse cx="166" cy="122" rx="16" ry="27" fill="#3C9BB0">${anim ? '<animateTransform attributeName="transform" type="rotate" values="-18 166 122; -8 166 122; -18 166 122" dur="2.6s" repeatCount="indefinite"/>' : ''}</ellipse>`;
  const eyesOpen = `<g class="eyes-open"><ellipse cx="76" cy="94" rx="17" ry="17" fill="#fff">${blink}</ellipse><ellipse cx="124" cy="94" rx="17" ry="17" fill="#fff">${blink}</ellipse><ellipse cx="79" cy="97" rx="9" ry="9" fill="#1F3A44">${pblink}</ellipse><ellipse cx="127" cy="97" rx="9" ry="9" fill="#1F3A44">${pblink}</ellipse><circle cx="82" cy="93" r="3" fill="#fff"/><circle cx="130" cy="93" r="3" fill="#fff"/></g>`;
  const eyesHappy = `<g class="eyes-happy"><path d="M62 98 Q76 82 90 98" fill="none" stroke="#1F3A44" stroke-width="6" stroke-linecap="round"/><path d="M110 98 Q124 82 138 98" fill="none" stroke="#1F3A44" stroke-width="6" stroke-linecap="round"/></g>`;
  return `<svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" class="chiku-svg ${mood === 'happy' ? 'is-happy' : ''}">
  <style>.chiku-body .eyes-happy{display:none}.chiku-body.happy .eyes-happy, .is-happy .eyes-happy{display:block}.chiku-body.happy .eyes-open, .is-happy .eyes-open{display:none}</style>
  <ellipse cx="100" cy="190" rx="54" ry="8" fill="#1F3A44" opacity="0.12"/>
  <g class="chiku-body">${bob}
    <ellipse cx="82" cy="182" rx="12" ry="7" fill="#F2A65A"/><ellipse cx="118" cy="182" rx="12" ry="7" fill="#F2A65A"/>
    <path d="M90 44 Q100 18 110 44" fill="none" stroke="#4FB3C8" stroke-width="9" stroke-linecap="round"/>
    <ellipse cx="34" cy="122" rx="16" ry="27" fill="#3C9BB0">${lwing}</ellipse>
    ${right}
    <circle cx="100" cy="112" r="72" fill="#4FB3C8"/>
    <ellipse cx="100" cy="132" rx="46" ry="38" fill="#CDEFF5"/>
    ${eyesOpen}${eyesHappy}
    <ellipse cx="58" cy="120" rx="10" ry="6" fill="#F4A3A0" opacity="0.75"/><ellipse cx="142" cy="120" rx="10" ry="6" fill="#F4A3A0" opacity="0.75"/>
    <path d="M90 110 L110 110 L100 123 Z" fill="#F2A65A" stroke="#F2A65A" stroke-width="4" stroke-linejoin="round"/>
  </g></svg>`;
}
