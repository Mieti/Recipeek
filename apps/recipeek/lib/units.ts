export const unitGroups = [
  {label:'Peso',units:[['g','Grammi · g','g'],['kg','Chilogrammi · kg','kg'],['mg','Milligrammi · mg','mg'],['oz','Once · oz','oz'],['lb','Libbre · lb','lb']]},
  {label:'Volume',units:[['ml','Millilitri · ml','ml'],['cl','Centilitri · cl','cl'],['dl','Decilitri · dl','dl'],['l','Litri · l','l']]},
  {label:'Misure di cucina',units:[['cucchiaini','Cucchiaino · tsp','cucchiaino'],['cucchiai','Cucchiaio · tbsp','cucchiaio'],['scoop','Scoop / misurino','scoop'],['tazze','Tazza · cup','tazza'],['bicchieri','Bicchiere','bicchiere'],['mestoli','Mestolo','mestolo'],['pizzichi','Pizzico','pizzico'],['manciate','Manciata','manciata'],['gocce','Goccia','goccia']]},
  {label:'A pezzi',units:[['pezzi','Pezzo','pezzo'],['fette','Fetta','fetta'],['spicchi','Spicchio','spicchio'],['foglie','Foglia','foglia'],['rametti','Rametto','rametto'],['gambi','Gambo','gambo'],['baccelli','Baccello','baccello'],['lattine','Lattina','lattina'],['vasetti','Vasetto','vasetto'],['confezioni','Confezione','confezione']]},
] as const;
const units=unitGroups.flatMap<readonly [string,string,string]>(group=>group.units);
const aliases:Record<string,string>={grammo:'g',grammi:'g',chilogrammo:'kg',chilogrammi:'kg',litro:'l',litri:'l',millilitro:'ml',millilitri:'ml',tsp:'cucchiaini',tbsp:'cucchiai',cup:'tazze',cups:'tazze',misurino:'scoop',misurini:'scoop'};
export function canonicalUnit(value:string){const key=value.trim().toLocaleLowerCase('it');return units.find(unit=>unit[0]===key||unit[2]===key)?.[0]??aliases[key]??value;}
export function isKnownUnit(value:string){return !value||units.some(unit=>unit[0]===canonicalUnit(value));}
export function formatUnit(value:string,quantity:number|null){if(quantity===null)return '';const key=canonicalUnit(value),unit=units.find(unit=>unit[0]===key);return unit ? Math.abs(quantity)===1?unit[2]:unit[0] : value;}
