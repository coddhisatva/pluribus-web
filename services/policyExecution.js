async function createPolicyExecution(creatorId, reason) {
  const execution = await PolicyExecution.create({...});
  await createSupporterRecords(execution);
  return execution;
} 