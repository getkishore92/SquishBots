import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolveConfig,referenceSvg} from './resolve.mjs';
mkdirSync('configs/resolved',{recursive:true});
for(const name of ['round','organic','triangle','cloud','ghost','monster','boxy','material-resin','material-clay','material-fur']){
 const config=JSON.parse(readFileSync(`configs/${name}.json`,'utf8'));
 writeFileSync(`configs/resolved/${name}.json`,JSON.stringify(resolveConfig(config),null,2)+'\n');
 writeFileSync(`configs/resolved/${name}.svg`,referenceSvg(config));
}
