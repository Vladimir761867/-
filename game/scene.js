'use strict';
// All art is drawn with Canvas; there are no external textures, models or marks.
function render() {
  const s = sector(), horizon = height * .49;
  const sky = ctx.createLinearGradient(0,0,0,height);
  s.sky.forEach((color,i)=>sky.addColorStop([0,.35,.51,1][i],color));
  ctx.fillStyle = sky;
  ctx.fillRect(0,0,width,height);
  const sx = width*.72, sy = horizon*.78;
  const glow = ctx.createRadialGradient(sx,sy,0,sx,sy,Math.min(width,height)*.4);
  glow.addColorStop(0,s.sun);
  glow.addColorStop(1,'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0,0,width,height);
  ctx.fillStyle = s.sun;
  ctx.beginPath();
  ctx.arc(sx,sy,Math.min(width,height)*.032,0,Math.PI*2);
  ctx.fill();
  drawClouds();
  drawLandscape(horizon);
  for (const o of run.objects) drawObject(o);
  const lock = sector().targets ? target() : null;
  if (lock) {
    ctx.strokeStyle = '#ffe4b5';
    ctx.lineWidth = 1.5;
    const x=lock.x*width,y=lock.y*height;
    for (const [dx,dy] of [[1,1],[-1,1],[1,-1],[-1,-1]]) {
      ctx.beginPath(); ctx.moveTo(x+dx*16,y+dy*24); ctx.lineTo(x+dx*24,y+dy*24); ctx.lineTo(x+dx*24,y+dy*16); ctx.stroke();
    }
  }
  ctx.strokeStyle='#ffe8b7';
  ctx.lineWidth=2;
  for(const shot of run.shots) {
    ctx.beginPath();ctx.moveTo(shot.x*width,shot.y*height);ctx.lineTo(shot.x*width,shot.y*height+12);ctx.stroke();
  }
  drawAirframe();
  for(const p of run.sparks) {
    ctx.globalAlpha = Math.min(1,p.life*2.4); ctx.fillStyle=p.color; ctx.fillRect(p.x*width,p.y*height,3,3);
  }
  ctx.globalAlpha=1;
}
function drawClouds() {
  ctx.save();
  for(let i=0;i<9;i++) {
    const x=((i*.313+run.t*(.008+i*.001))%1.4-.2)*width, y=(.16+(i*.179)% .34)*height;
    const r=Math.max(20,width*(.07+i*.008));
    ctx.save();ctx.translate(x,y);ctx.scale(1,.24);
    const fade=ctx.createRadialGradient(0,0,0,0,0,r);
    fade.addColorStop(0,'rgba(255,237,223,.38)');fade.addColorStop(1,'rgba(255,237,223,0)');
    ctx.fillStyle=fade;ctx.fillRect(-r,-r,r*2,r*2);ctx.restore();
  }
  ctx.restore();
}
function drawLandscape(horizon) {
  const canyon = sectorId==='canyon';
  for(let layer=0;layer<2;layer++) {
    ctx.fillStyle=sector().terrain[layer];
    ctx.globalAlpha=.8;
    ctx.beginPath();
    ctx.moveTo(0,height);
    const steps=Math.max(16,Math.ceil(width/38));
    for(let i=0;i<=steps;i++) {
      const x=i/steps, f=x*(9+layer*6)+run.t*(.08+layer*.04);
      const bank=canyon ? Math.pow(Math.abs(x-.5)*2,1.45)*.22 : 0;
      const ridge=(Math.sin(f)*.032+Math.cos(f*2.29)*.02)* (canyon ? 1.3 : .58);
      ctx.lineTo(x*width,horizon+height*(layer*.12-bank-ridge));
    }
    ctx.lineTo(width,height);ctx.closePath();ctx.fill();
  }
  ctx.globalAlpha=1;
  ctx.strokeStyle=canyon?'rgba(255,180,145,.1)':'rgba(196,241,255,.16)';
  ctx.lineWidth=1;
  for(let i=0;i<11;i++){
    const y=horizon+Math.pow((i*.091+run.t*.17)%1,1.8)*height*.53;
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y+height*.024);ctx.stroke();
  }
}
function drawObject(o) {
  const x=o.x*width, y=o.y*height;
  if(o.type==='gate') drawGate(x,y);
  ctx.save();ctx.translate(x,y);
  if(o.type==='ring'||o.type==='gate'){
    const radius=width*(o.type==='gate'?.112:.15);
    ctx.globalAlpha=o.checked?.29:1;
    ctx.lineWidth=3;ctx.strokeStyle='#ffcb82';ctx.shadowColor='#ff9b52';ctx.shadowBlur=10;
    ctx.beginPath();ctx.ellipse(0,0,radius,Math.min(29,radius*.5),0,0,Math.PI*2);ctx.stroke();
    ctx.shadowBlur=0;ctx.strokeStyle='#fff0bd';ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(0,0,radius*.9,Math.min(24,radius*.42),0,0,Math.PI*2);ctx.stroke();
  } else if(o.type==='repair'||o.type==='series'){
    ctx.rotate(Math.PI/4);
    ctx.fillStyle=o.type==='repair'?'#123e3f':'#4b315c';ctx.strokeStyle=o.type==='repair'?'#a4ffd0':'#e4b9ff';ctx.lineWidth=2;
    ctx.fillRect(-13,-13,26,26);ctx.strokeRect(-13,-13,26,26);
    ctx.rotate(-Math.PI/4);ctx.fillStyle=ctx.strokeStyle;ctx.font='bold 17px system-ui';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(o.type==='repair'?'✚':'✦',0,0);
  } else {
    ctx.fillStyle=o.type==='ace'?'#ffe1a2':'#ff8e87';
    ctx.strokeStyle='#301b34';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,17);ctx.lineTo(-21,-10);ctx.lineTo(-7,-7);ctx.lineTo(0,-16);ctx.lineTo(7,-7);ctx.lineTo(21,-10);ctx.closePath();
    ctx.stroke();ctx.fill();
    ctx.fillStyle='#552f43';ctx.fillRect(-3,-4,6,12);
    if(o.type==='ace'){ctx.fillStyle='#fff5cb';ctx.fillRect(-8,-22,o.hp*8,2);}
  }
  ctx.restore();
}
function drawGate(x,y) {
  const gap=width*.112;
  for(const side of [-1,1]) {
    ctx.save();ctx.translate(x+side*gap,y);ctx.scale(side,1);
    const reach=width, lip=width*.032;
    ctx.fillStyle='#392840';ctx.strokeStyle='#bf8676';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(lip,-19);ctx.lineTo(reach,-42);ctx.lineTo(reach,37);ctx.lineTo(lip,17);ctx.closePath();
    ctx.fill();ctx.stroke();
    ctx.fillStyle='#6e4655';ctx.beginPath();ctx.moveTo(lip,-19);ctx.lineTo(reach,-42);ctx.lineTo(reach,-14);ctx.lineTo(lip,0);ctx.closePath();ctx.fill();
    ctx.restore();
  }
}
function drawAirframe() {
  const p=flightPlane();
  ctx.save();ctx.translate(run.x*width,run.y*height);ctx.rotate(run.bank);
  const scale=clamp(width/440,.55,.95);
  const roll=run.rollEnd>run.t ? Math.cos((1-(run.rollEnd-run.t)/.48)*Math.PI*2) : 1;
  ctx.scale(scale*(roll<0?-1:1)*Math.max(.22,Math.abs(roll)),scale);
  ctx.globalAlpha=run.safeUntil>run.t?.65:1;
  for(const x of [-6,6]) {
    const trail=ctx.createLinearGradient(0,24,0,94);
    trail.addColorStop(0,'#fff2c7');trail.addColorStop(.24,p.color);trail.addColorStop(1,'transparent');
    ctx.strokeStyle=trail;ctx.lineWidth=3.2;ctx.beginPath();ctx.moveTo(x,25);
    ctx.quadraticCurveTo(x-run.bank*23,55,x-run.bank*60,80+Math.sin(run.t*25+x)*9);ctx.stroke();
  }
  const hull=ctx.createLinearGradient(-22,-38,35,36);
  hull.addColorStop(0,p.body);hull.addColorStop(1,p.shadow);
  ctx.fillStyle=hull;ctx.strokeStyle=p.color;ctx.lineWidth=1.2;
  ctx.beginPath();
  p.outline.split(' ').forEach((point,i)=>{
    const [x,y]=point.split(',').map(Number);
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  });
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#081827';ctx.beginPath();ctx.moveTo(0,-32);ctx.lineTo(5,-11);ctx.lineTo(0,0);ctx.lineTo(-5,-11);ctx.closePath();ctx.fill();
  ctx.restore();
}
