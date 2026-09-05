import { CATALOG } from '../core/catalog.mjs';
export default function handler(req,res){if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});res.status(200).json(CATALOG)}
