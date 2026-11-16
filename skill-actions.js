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
  if (!Number.isSafeInteger(amount) || amount<0 || amount>10000000 || choice.amount==='') throw Error('請輸入結算後的點數。');
  if (choice.target) {
   const [owner,partner] = JSON.parse(choice.target);
   target = hpTarget(data,owner,partner);
   if(target.partner?.type==='靈寵' && target.before===0 && choice.effect==='治療')throw Error('請先召喚靈寵。');
   after = choice.effect==='治療'?Math.min(target.max,target.before+amount):Math.max(0,target.before-amount);
   detail.push(`${target.name} · ${choice.effect} ${amount} · HP ${target.before} → ${after}`);
  } else if(choice.effect==='治療') throw Error('請選擇治療對象。');
  else detail.push(`其他目標 · 傷害 ${amount}`);
 }
 return {caster,skill,key,spent:[...spent,...free.slice(0,cost)],target,after,detail:detail.join(' ／ '),damage:choice.effect==='受傷'?amount:null};
}
const pendingSkills = new Map();
function skillPanelControls(c, healing) {
 const draft=pendingSkills.get(c.id);
 if(!dm || !draft || (draft.choice.effect==='治療')!==healing)return '';
 const simpleHeal=healing && resourceClass(c)!=='cleric';
 return `<div class="skill-panel-controls"><strong>${esc(draft.name)}</strong>
 ${simpleHeal?`<label>技能補血骰點<input type="number" min="0" max="999999" data-simple-heal value="${esc(draft.choice.amount)}"></label>`:''}
 <button type="button" data-skill-step="setup">返回上一步</button>
 <button type="button" class="primary" data-skill-step="review">預覽本次行動</button>
 <button type="button" data-skill-step="cancel">取消行動</button></div>`;
}
function openSkillAction(casterId,skillId,previous) {
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
 <label data-amount>技能骰點<input name="amount" type="number" min="0" max="999999" inputmode="numeric"></label></div>
 <p role="status"></p><div class="actions"><button type="button" data-combat-skills="${esc(casterId)}">返回技能概覽</button><button class="primary">帶入戰鬥面板</button></div></form>`);
 const form=$('#skillActionForm'), fields=form.elements, submit=form.querySelector('.primary');
 if(previous)for(const [key,value] of Object.entries(previous.choice))if(fields.namedItem(key))fields.namedItem(key).value=value;
 function preview() {
  const choice=Object.fromEntries(new FormData(form)), active=choice.effect!=='無 HP 變化';
  form.querySelector('[data-cost]').hidden=choice.pool!=='focus';
  for(const attr of ['data-target','data-amount'])form.querySelector('['+attr+']').hidden=!active;
  try {
   if(active && !/^\d{1,6}$/.test(choice.amount))throw Error('請輸入玩家擲出的原始點數。');
   const plan=planSkillAction(state,casterId,skillId,{...choice,amount:'0'});
   form.querySelector('[role=status]').textContent=plan.detail.split(' ／ ')[0];
   submit.disabled=false;
  }catch(err){form.querySelector('[role=status]').textContent=err.message;submit.disabled=true;}
 }
 form.oninput=preview;preview();
 if(fields.effect.value!=='無 HP 變化')fields.amount.focus();
 form.onsubmit=e=>{
  e.preventDefault();if(!dm || submit.disabled)return;
  const choice=Object.fromEntries(new FormData(form));
  const draft={id:previous?.id || uid(),skillId,name:skill.name,choice};
  pendingSkills.set(casterId,draft);
  if(choice.effect==='受傷')combatDrafts.set(casterId,{...combatDrafts.get(casterId),roll:choice.amount});
  if(choice.effect==='治療')healingDrafts.set(casterId,{...healingDrafts.get(casterId),roll:choice.amount,...(/^slot[1-9]$/.test(choice.pool)?{level:choice.pool.slice(4)}:{})});
  close();render();
  const row=document.getElementById('combatant-'+casterId);
  const input=choice.effect==='受傷'?row.querySelector('[data-combat-roll]'):choice.effect==='治療'?row.querySelector('[data-healing-roll],[data-simple-heal]'):null;
  (input || row.querySelector('[data-skill-step="review"]'))?.focus();
 };
}
function panelSkillResult(data,row,c,draft) {
 const field=selector=>row.querySelector(selector)?.value;
 const effect=draft.choice.effect;
 if(effect==='受傷'){
  const result=combatCalculation(c,field('[data-combat-roll]'),field('[data-combat-ability]'),data,readCombatAttack(row));
  if(result.error)throw Error(result.error);
  return {total:result.total,attack:result,roll:result.roll};
 }
 if(effect==='治療'){
  if(resourceClass(c)==='cleric'){
   const effects=readHealingEffects(row.querySelector('.healing-panel'));
   if(draft.choice.pool.startsWith('slot') && effects.level!==draft.choice.pool.slice(4))throw Error('面板與本次消耗的環階不同，請返回上一步調整消耗，或修改補血環階。');
   const result=healingCalculation(c,field('[data-healing-roll]'),field('[data-healing-item]'),field('[data-healing-bonus]'),data,effects);
   if(result.error)throw Error(result.error);
   return result;
  }
  const roll=field('[data-simple-heal]');
  if(!/^\d{1,6}$/.test(roll))throw Error('請輸入技能補血骰點。');
  return {total:Number(roll),roll};
 }
 return {total:0};
}
function stageSkill(data,row,cid,draft) {
 const c=data.characters.find(person=>person.id===cid);
 const result=panelSkillResult(data,row,c,draft);
 const plan=planSkillAction(data,cid,draft.skillId,{...draft.choice,amount:String(result.total)});
 if(plan.key){c.resourceSpent??={};c.resourceSpent[plan.key]=plan.spent;}
 if(plan.target && plan.after!==plan.target.before)applyCurrentHp(data,plan.target.owner.id,plan.target.partner?.id || '',String(plan.after));
 if(result.roll!=null)plan.detail='骰點 '+result.roll+' → 結算 '+result.total+' ／ '+plan.detail;
 if(result.self){
  const self=hpTarget(data,cid,''),after=Math.min(self.max,self.before+result.self);
  applyCurrentHp(data,cid,'',String(after));plan.detail+=` ／ 祝醫聖者 HP ${self.before} → ${after}`;
 }
 const at=new Date().toISOString();
 data.battleDamage??={entries:[]};
 if(result.attack)recordBattleDamage(data,c,result.attack,draft.id,at);
 (data.battleDamage.skillActions??=[]).push({id:draft.id,name:c.name,skill:draft.name,detail:plan.detail,at});
 return plan.detail;
}
document.addEventListener('input',event=>{
 if(event.target.matches('[data-simple-heal]')){
  const draft=pendingSkills.get(event.target.closest('[data-combat-row]').dataset.combatRow);
  if(draft)draft.choice.amount=event.target.value;
 }
});
document.addEventListener('click',event=>{
 const use=event.target.closest('[data-use-skill]');
 if(use){openSkillAction(use.dataset.caster,use.dataset.useSkill);return;}
 const button=event.target.closest('[data-skill-step]');
 if(!dm || !button)return;
 const row=button.closest('[data-combat-row]'),cid=row.dataset.combatRow,draft=pendingSkills.get(cid);
 if(!draft)return;
 const field=draft.choice.effect==='受傷'?'[data-combat-roll]':'[data-healing-roll],[data-simple-heal]';
 draft.choice.amount=row.querySelector(field)?.value ?? draft.choice.amount;
 if(button.dataset.skillStep==='setup'){openSkillAction(cid,draft.skillId,draft);return;}
 if(button.dataset.skillStep==='cancel'){pendingSkills.delete(cid);render();return;}
 try {
  const detail=stageSkill(structuredClone(state),row,cid,draft);
  modal(`<h2>${esc(draft.name)} · 行動確認</h2><p>${esc(detail)}</p><div class="actions"><button data-close>返回上一步</button><button class="primary" id="commitPanelSkill">確認本次行動</button></div>`);
  $('#commitPanelSkill').onclick=async e=>{
   const submit=e.currentTarget;
   if(!dm || submit.disabled)return;
   submit.disabled=true;
   try {
    const next=structuredClone(state);
    if(!next.battleDamage?.skillActions?.some(a=>a.id===draft.id)){
     if(stageSkill(next,row,cid,draft)!==detail)throw Error('數值已更新，請返回面板重新預覽。');
     if(!await persist(next))return;
    }
    pendingSkills.delete(cid);close();render();toast('已記錄 '+draft.name);
   }catch(error){toast(error.message)}finally{submit.disabled=false;}
  };
 }catch(error){toast(error.message)}
});
