import assert from 'node:assert/strict';

// Extra full-fixture checks isolated from the main review page.
export async function verifyEdges(context, base, output) {
const result={checks:[],errors:[]};
const page=await context.newPage();
await page.setViewportSize({width:1440,height:1000});
page.on('pageerror',e=>result.errors.push(e.message));
const wait=()=>page.waitForTimeout(400);
const canvas=()=>page.locator('canvas[data-matrix-entries]');
async function scene(){return canvas().evaluate(c=>{let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber'))];while(f&&!f.stateNode?.scene)f=f.return;return{windows:f.stateNode.scene.windows.map(w=>({x:w.x,width:w.width,domain:w.domain})),gutter:f.stateNode.scene.gutterWidth};});}
try{
 await page.goto(`${base}/?file=BWH70_phylogeny,BWH70_MR_2_pl1_10h&location=1:1-1:10000000|18:68000000-18:74000000&genes=1&genesPinned=1`);
 await page.waitForSelector('canvas[data-matrix-entries="92000"]',{timeout:60000});
 await page.getByRole('button',{name:'Pin heatmap',exact:true}).click();
 await page.locator('[data-plot-type="genome"]').scrollIntoViewIfNeeded();await wait();
 const s=await scene();assert.equal(s.windows.length,2);
 const c=await canvas().boundingBox();
 const geometry=await page.locator('.pgv-genes-panel .zoom-background, [data-plot-type="genome"] .zoom-background').evaluateAll(es=>es.map(e=>({x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width,gene:!!e.closest('.pgv-genes-panel')})));
 assert.equal(geometry.length,4);
 geometry.forEach((g,i)=>{const w=s.windows[i%2];assert.ok(Math.abs(g.x-(c.x+w.x))<1,JSON.stringify({g,w,c}));assert.ok(Math.abs(g.width-w.width)<1);});
 result.checks.push({name:'Two disjoint domains align across heatmap, pinned genes and genome; tree preserved with multiple initial files',geometry});
 const bounds=await page.locator('.phylogeny-linked-panel').boundingBox();
 const geneBounds=await page.locator('.pgv-genes-panel .ant-card').boundingBox();
 assert.ok(bounds.y>=geneBounds.y+geneBounds.height-1);
 result.checks.push({name:'Pinned heatmap does not overlap pinned genes',bounds,geneBounds});
 await page.screenshot({path:`${output}/screenshots/native-split-domains-genes.png`});
 await page.keyboard.down('Meta');
 const resetBox=await canvas().boundingBox();
 await page.mouse.dblclick(resetBox.x+s.windows[0].x+30,resetBox.y+8);
 await page.keyboard.up('Meta'); await wait();
 const url=page.url();assert.match(new URL(url).searchParams.get('location'),/^1:1-/);
 await page.reload();await page.waitForSelector('canvas[data-matrix-entries="92000"]',{timeout:60000});
 assert.equal((await scene()).windows.length,2);
 result.checks.push({name:'Double-click domain reset round-trips through genomic URL and reload'});
 await page.goto(`${base}/?file=BWH70_MR_2_pl1_10h&location=10:1-10:133797422`);
 await page.waitForSelector('[data-plot-type="genome"] .zoom-background',{timeout:30000});
 assert.equal(await page.locator('.phylogeny-heatmap').count(),0);
 result.checks.push({name:'Legacy single-cell view still loads without tree or new gutter'});

 await page.route('**/data/BWH70_phylogeny/mutations.plotly.json',route=>route.fulfill({status:404,body:'Fixture intentionally unavailable'}));
 await page.goto(`${base}/?file=BWH70_phylogeny&location=18:68000000-18:74000000`);
 await page.waitForSelector('.phylogeny-warnings',{timeout:60000});
 assert.equal(await canvas().getAttribute('data-cell-count'),'125');
 assert.equal(await canvas().getAttribute('data-matrix-entries'),'0');
 await page.locator('.phylogeny-warnings summary').click();
 assert.match(await page.locator('.phylogeny-warnings').innerText(),/Mutations/);
 assert.ok(Number(await canvas().getAttribute('data-frame-cn-drawn'))>0);
 await page.unroute('**/data/BWH70_phylogeny/mutations.plotly.json');
 await page.getByRole('button',{name:'Retry overview',exact:true}).click();
 await page.waitForSelector('canvas[data-matrix-entries="92000"]',{timeout:60000});
 result.checks.push({name:'Missing mutation input leaves CN usable, warning explicit, retry restores all92000values'});
 assert.deepEqual(result.errors,[]);
 result.ok=true;
}catch(e){result.ok=false;result.error=e.stack;await page.screenshot({path:`${output}/screenshots/native-edge-failure.png`});}
finally { await page.close(); }
return result;

}
