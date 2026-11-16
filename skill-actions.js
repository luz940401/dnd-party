function skillActionHistory() {
 const actions = state.battleDamage?.skillActions || [];
 return `<details><summary>技能行動 · ${actions.length} 筆</summary><div class="battle-history">${actions.slice().reverse().map(a=>`<article><strong>${esc(a.name)} · ${esc(a.skill)}</strong><small>${esc(a.detail)}</small></article>`).join('') || '<p>尚無技能行動。</p>'}</div></details>`;
}
function planSkillAction(data, casterId, skillId, choice) {
 const caster = data.characters.find(c=>c.id===casterId);
 const skill = data.skillLibrary?.find(t=>t.id===skillId);
 const entry = caster?.skills?.find(e=>e.skillId===skillId);
 if (!entry || !skill || skill.type===spiritType) throw Error('角色技能已變更，請重新選擇。');
 const key = choice.pool, cost = key==='focus' ? Number(choice.cost) : key ? 1 : 0;
 const pool = resourcePools(caster).find(p=>p.key===key);
 if (key && !pool) throw Error('此角色沒有選取的戰鬥資源。');
 if (!Number.isSafeInteger(cost) || cost<0 || cost>20) throw Error('請填寫有效氣點。');
 const spent = caster.resourceSpent?.[key] || [];
 const free = Array.from({length:pool?.max || 0},(_,i)=>i).filter(i=>!spent.includes(i));
 if (free.length<cost) throw Error('剩餘資源不足，請調整消耗。');
 const detail = [cost ? `消耗 ${pool.label} × ${cost}` : '無資源消耗'];
 const amount = Number(choice.amount);
 let target, after;
 if (choice.effect!=='無 HP 變化') {
  if (!/^\d{1,6}$/.test(choice.amount)) throw Error('請輸入結算後的點數。');
  if (choice.target) {
   const [owner,partner] = JSON.parse(choice.target);
   target = hpTarget(data,owner,partner);
   after = amount ? hpChangeResult(target,choice.effect,amount) : target.before;
   detail.push(`${target.name} · ${choice.effect} ${amount} · HP ${target.before} → ${after}`);
  } else if(choice.effect==='治療') throw Error('請選擇治療對象。');
  else detail.push(`其他目標 · 傷害 ${amount}`);
 }
 return {caster,skill,key,spent:[...spent,...free.slice(0,cost)],target,after,detail:detail.join(' ／ '),damage:choice.effect==='受傷'?amount:null};
}
function openSkillAction(casterId,skillId) {
 const caster=state.characters.find(c=>c.id===casterId), skill=state.skillLibrary?.find(s=>s.id===skillId);
 if (!dm || !skill || !caster?.skills?.some(e=>e.skillId===skillId)) return;
 const pools=resourcePools(caster), type=skillResourceType(skill);
 const defaultKey=type==='ki' && Number(skill.kiCost)>0?'focus':type==='spell' && Number(skill.spellLevel)>0?'slot'+skill.spellLevel:'';
 const keys=pools.map(p=>({key:p.key,label:p.label}));
 if(defaultKey && !keys.some(p=>p.key===defaultKey))keys.push({key:defaultKey,label:defaultKey==='focus'?'氣點（未取得）':skill.spellLevel+' 環（未取得）'});
 const targets=state.characters.flatMap(c=>[{id:[c.id,''],name:c.name},...combatCompanions(c).map(p=>({id:[c.id,p.id],name:c.name+' · '+p.name}))]);
 const effect=skill.type==='攻擊技能'?'受傷':/治療|補血/.test(skill.name)?'治療':'無 HP 變化';
 modal(`<h2>${esc(caster.name)} · 使用${esc(skill.name)}</h2><form id="skillActionForm"><div class="form-grid">
 <label>本次消耗<select name="pool"><option value="">無資源消耗</option>${keys.map(p=>`<option value="${esc(p.key)}" ${p.key===defaultKey?'selected':''}>${esc(p.label)}</option>`).join('')}</select></label>
 <label data-cost>氣點<input name="cost" type="number" min="0" max="20" value="${esc(skill.kiCost || '1')}"></label>
 <label>本次效果<select name="effect">${options(['無 HP 變化','受傷','治療'],effect)}</select></label>
 <label data-target>對象<select name="target"><option value="">其他目標（僅記傷害）</option>${targets.map(t=>`<option value="${esc(JSON.stringify(t.id))}">${esc(t.name)}</option>`).join('')}</select></label>
 <label data-amount>結算後點數<input name="amount" type="number" min="0" max="999999" inputmode="numeric"></label></div>
 <p role="status"></p><div class="actions"><button type="button" data-combat-skills="${esc(casterId)}">返回技能概覽</button><button class="primary">確認本次行動</button></div></form>`);
 const form=$('#skillActionForm'), fields=form.elements, submit=form.querySelector('.primary'), id=uid();
 let busy=false;
 const choice=()=>Object.fromEntries(new FormData(form));
 function preview() {
  form.querySelector('[data-cost]').hidden=fields.pool.value!=='focus';
  for(const attr of ['data-target','data-amount'])form.querySelector('['+attr+']').hidden=fields.effect.value==='無 HP 變化';
  try { form.querySelector('[role=status]').textContent=planSkillAction(state,casterId,skillId,choice()).detail;submit.disabled=busy; }
  catch(err){form.querySelector('[role=status]').textContent=err.message;submit.disabled=true;}
 }
 form.oninput=preview;preview();
 if(effect!=='無 HP 變化')fields.amount.focus();
 form.onsubmit=async e=>{
  e.preventDefault();
  if (!dm || busy || submit.disabled)return;
  busy=true;submit.disabled=true;
  try {
   const next=structuredClone(state);
   next.battleDamage??={entries:[]};
   const log=next.battleDamage.skillActions??=[];
   if(log.some(a=>a.id===id)){close();render();return;}
   const plan=planSkillAction(next,casterId,skillId,choice());
   if(plan.detail!==form.querySelector('[role=status]').textContent){toast('資料已更新，請再次確認預覽。');return;}
   if(plan.key){plan.caster.resourceSpent??={};plan.caster.resourceSpent[plan.key]=plan.spent;}
   if(plan.target && plan.after!==plan.target.before)applyCurrentHp(next,plan.target.owner.id,plan.target.partner?.id || '',String(plan.after));
   const name=plan.caster.name, at=new Date().toISOString();
   log.push({id,name,skill:skill.name,detail:plan.detail,at});
   if(plan.damage!==null)next.battleDamage.entries.push({id,characterId:casterId,name,total:plan.damage,formula:skill.name+' · '+plan.detail,at});
   if(await persist(next)){close();render();toast('已記錄 '+skill.name);}
  }catch(error){toast(error.message)}finally{busy=false;if(form.isConnected)preview();}
 };
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-use-skill]');
 if(button)openSkillAction(button.dataset.caster,button.dataset.useSkill);
});
