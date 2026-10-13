alter table concloud."OpeningLead"
  add column "pagbankCheckoutId" text,
  add column "pagbankCheckoutUrl" text,
  add column "pagbankPlanId" text,
  add column "pagbankPaymentId" text,
  add column "pagbankSubscriptionId" text,
  add column "paymentStatus" text not null default 'PENDING'
    check ("paymentStatus" in ('PENDING','WAITING','IN_ANALYSIS','PAID','DECLINED','CANCELED','EXPIRED')),
  add column "paymentAmount" integer,
  add column "paidAt" timestamp(3),
  add column "paymentUpdatedAt" timestamp(3);

create unique index "OpeningLead_pagbankCheckoutId_key"
  on concloud."OpeningLead" ("pagbankCheckoutId")
  where "pagbankCheckoutId" is not null;

create index "OpeningLead_paymentStatus_idx"
  on concloud."OpeningLead" ("paymentStatus");
