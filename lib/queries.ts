export const selectSessionQuery = `
SELECT userid 
FROM public.sessions
WHERE id = $1
`

export const selectKeysQuery = `
SELECT encryptedprivatekey, publickey 
FROM public.keys
WHERE userid = $1
`

export const selectDeviceQuery = 
`SELECT userid, deviceid 
 FROM public.keys 
 WHERE deviceid = $1`
