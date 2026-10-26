function mobileDirectory(){
 const content=document.querySelector('#content');if(!content)return;
 let bar=document.querySelector('#mobileBrowse');if(!bar){bar=document.createElement('div');bar.id='mobileBrowse';bar.innerHTML='<details id="mobileDirectory"><summary>☰ 快速目錄</summary><div class="mobile-directory-links"></div></details><button type="button" id="mobileDensity" aria-pressed="false">切換三欄</button><button type="button" data-mobile-top aria-label="回到頁首">↑ 頂端</button>';document.body.append(bar)}
 content.querySelectorAll('[data-mobile-anchor]').forEach(el=>el.removeAttribute('data-mobile-anchor'));bar.querySelector('#mobileDensity').hidden=page==='combat';const targets=[];const add=(el,label)=>{if(!el)return;const index=targets.length;el.dataset.mobileAnchor=String(index);targets.push({el,label})};
 content.querySelectorAll('[data-combat-row]').forEach(el=>add(el,el.querySelector('h2')?.textContent||'戰鬥角色'));add(content.querySelector('.party-tabs'),'選擇角色');add(content.querySelector('.character-panel'),'角色資訊');
 content.querySelectorAll('.skill-group').forEach(el=>add(el,el.querySelector('summary>span')?.textContent.trim()||'技能'));
 add(content.querySelector('.loadout'),'目前裝備');add(content.querySelector('.toolbar'),'搜尋／篩選道具');
 content.querySelectorAll('.category-group,.library-group').forEach(el=>add(el,el.querySelector('h3')?.firstChild?.textContent.trim()||'道具分類'));
 bar.querySelector('.mobile-directory-links').innerHTML=targets.map(({label},index)=>`<button type="button" data-mobile-jump="${index}">${esc(label)}</button>`).join('')||'<span>本頁尚無分類</span>';
}
document.addEventListener('click',e=>{
 if(e.target.closest('#mobileDirectory>summary'))mobileDirectory();
 const jump=e.target.closest('[data-mobile-jump]');if(jump){const target=document.querySelector('#content [data-mobile-anchor="'+jump.dataset.mobileJump+'"]');document.querySelector('#mobileDirectory').open=false;if(target){if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({block:'start'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true})}}
 if(e.target.closest('[data-mobile-top]')){document.querySelector('#mobileDirectory').open=false;window.scrollTo({top:0})}
 if(e.target.closest('#mobileDensity')){const compact=document.body.classList.toggle('mobile-compact');const button=document.querySelector('#mobileDensity');button.textContent=compact?'切換兩欄':'切換三欄';button.setAttribute('aria-pressed',String(compact))}
});
