import {resolveConfig,referenceSvg} from '../core/resolve.mjs';
import {getTraitValues} from '../core/catalog.mjs';
export default function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{const body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(JSON.stringify(body).length>65536)return res.status(413).json({error:'Config exceeds 64 KB'});const resolved=resolveConfig(body.config??body);res.status(200).json({resolved,svg:referenceSvg(resolved.config),traitValues:getTraitValues(resolved.config)})}catch(error){res.status(400).json({error:error.message})}
}
