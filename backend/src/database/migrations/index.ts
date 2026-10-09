/**
 * Registry estática das migrations. O deploy Vercel faz bundle esbuild só do
 * código alcançável a partir de `serverless.main.js` — um glob de ficheiros
 * (`__dirname + '/database/migrations/*'`) não existe na função e descobre 0
 * migrations em silêncio. Toda a migration nova tem de ser exportada aqui
 * (o teste da pasta falha se falhar o export).
 */
export { InitialSchema1788572279614 } from './1788572279614-InitialSchema';
export { HardeningIndexes1789000000000 } from './1789000000000-HardeningIndexes';
export { AddAuditLogFields1789500000000 } from './1789500000000-AddAuditLogFields';
export { AddBalanceReversalFields1789600000000 } from './1789600000000-AddBalanceReversalFields';
export { AddSoftDelete1789700000000 } from './1789700000000-AddSoftDelete';
export { AddUserAccessCode1789800000000 } from './1789800000000-AddUserAccessCode';
export { CashClosureUniqueness1789900000000 } from './1789900000000-CashClosureUniqueness';
export { BalanceArchiving1790100000000 } from './1790100000000-BalanceArchiving';
export { AddEventShortCode1790200000000 } from './1790200000000-AddEventShortCode';
export { BackfillOrphanBalanceMembers1790300000000 } from './1790300000000-BackfillOrphanBalanceMembers';
