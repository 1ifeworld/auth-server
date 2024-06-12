import AWS from 'aws-sdk'

AWS.config.update({
    region: 'us-east-1',
    accessKeyId: process.env.ACCESS,
    secretAccessKey: process.env.SECRET,
  })
  
export  const kms = new AWS.KMS()
