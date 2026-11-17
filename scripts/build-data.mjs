// Downloads Natural Earth polygons + the OWID CO2 dataset and writes compact local copies.
import fs from 'node:fs';
const GEO='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
const CSV='https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv';
const get=async u=>{const r=await fetch(u);if(!r.ok)throw new Error(u+' '+r.status);return r;};
const r2=n=>Math.round(n*100)/100;
const rd=a=>typeof a[0]==='number'?[r2(a[0]),r2(a[1])]:a.map(rd);
fs.mkdirSync('public/data',{recursive:true});
const geo=await (await get(GEO)).json();
geo.features=geo.features.filter(f=>f.properties.CONTINENT!=='Antarctica').map(f=>({type:'Feature',
 properties:{iso:f.properties.ADM0_A3,iso2:f.properties.ISO_A2_EH||f.properties.ISO_A2,name:f.properties.NAME,cont:f.properties.CONTINENT},
 geometry:{type:f.geometry.type,coordinates:rd(f.geometry.coordinates)}}));
fs.writeFileSync('public/data/geo.json',JSON.stringify(geo));
const lines=(await (await get(CSV)).text()).split('\n');
const H=lines[0].split(',');const ix=n=>H.indexOf(n);
const out={};
for(const ln of lines.slice(1)){
  const r=ln.split(',');const iso=r[ix('iso_code')];
  if(!iso||iso.length!==3)continue;
  const y=+r[ix('year')];if(y<1900)continue;
  const v=n=>{const s=r[ix(n)];return s===''||s===undefined?null:r2(+s)};
  const o=out[iso]??={name:r[ix('country')],y0:1900,co2:[],pc:[],m:null};
  o.co2[y-1900]=v('co2');o.pc[y-1900]=v('co2_per_capita');
  if(v('coal_co2')!==null||v('oil_co2')!==null)
    o.m={Coal:v('coal_co2')||0,Oil:v('oil_co2')||0,Gas:v('gas_co2')||0,Cement:v('cement_co2')||0,Flaring:v('flaring_co2')||0,Other:v('other_industry_co2')||0};
}
fs.writeFileSync('public/data/emissions.json',JSON.stringify(out));
console.log('countries with data:',Object.keys(out).length);
