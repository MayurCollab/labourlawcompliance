const toActorDto = (actorId, actorEmail) => {
  if (!actorId && !actorEmail) return null;
  if (actorId && typeof actorId === 'object') {
    return {
      id: String(actorId._id ?? actorId.id ?? ''),
      name: actorId.name ?? null,
      email: actorId.email ?? actorEmail ?? null,
    };
  }
  return {
    id: actorId ? String(actorId) : null,
    name: null,
    email: actorEmail ?? null,
  };
};

const toClientDto = (client) => {
  if (!client) return null;
  if (typeof client !== 'object') {
    return {
      id: String(client),
      clientCode: null,
      companyName: null,
      location: null,
    };
  }
  const location = client.location;
  return {
    id: String(client._id ?? client.id),
    clientCode: client.clientCode ?? null,
    companyName: client.companyName ?? null,
    location:
      location && typeof location === 'object'
        ? {
            id: String(location._id ?? location.id ?? ''),
            name: location.name ?? null,
          }
        : null,
  };
};

export const toWhatsAppSendDto = (send) => ({
  id: String(send._id ?? send.id),
  filingId: send.filing ? String(send.filing._id ?? send.filing) : null,
  client: toClientDto(send.client),
  clientCode: send.clientCode ?? send.client?.clientCode ?? null,
  companyName: send.companyName ?? send.client?.companyName ?? null,
  phone: send.phone,
  period: send.period,
  periodLabel: send.periodLabel,
  filename: send.filename,
  mediaUrl: send.mediaUrl,
  templateName: send.templateName,
  status: send.status,
  requestId: send.requestId,
  providerMessageId: send.providerMessageId,
  errorMessage: send.errorMessage,
  sentAt: send.sentAt,
  deliveredAt: send.deliveredAt,
  readAt: send.readAt,
  failedAt: send.failedAt,
  statusUpdatedAt: send.statusUpdatedAt,
  actor: toActorDto(send.actorId, send.actorEmail),
  createdAt: send.createdAt,
  updatedAt: send.updatedAt,
});

export const toWhatsAppSendListDto = (sends) => sends.map(toWhatsAppSendDto);
