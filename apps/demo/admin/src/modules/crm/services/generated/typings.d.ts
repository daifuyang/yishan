// Preserved client types for the uninstalled CRM source; not part of Demo API codegen.
declare namespace CrmAPI {
type crmActivityGetParams = {
    id: number;
  };

type crmActivityDeleteParams = {
    id: number;
  };

type crmActivityUpdateParams = {
    id: number;
  };

type getCrmV1AttachmentsParams = {
    customerId: number;
  };

type deleteCrmV1AttachmentsIdParams = {
    id: number;
  };

type crmContactsListParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    customerId?: number;
    isPrimary?: number;
  };

type crmContactsDetailParams = {
    id: number;
  };

type crmContactsDeleteParams = {
    id: number;
  };

type crmContactsUpdateParams = {
    id: number;
  };

type getCrmV1ContractsParams = {
    page?: number;
    pageSize?: number;
    keyword?: string & string;
    customerId?: number;
    status?: "draft" | "performing" | "completed" | "terminated";
  };

type getCrmV1ContractsIdParams = {
    id: number;
  };

type deleteCrmV1ContractsIdParams = {
    id: number;
  };

type patchCrmV1ContractsIdParams = {
    id: number;
  };

type crmCustomersListParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    view?:
      | "all"
      | "important"
      | "mine"
      | "collaborating"
      | "pending"
      | "stale7d"
      | "pool";
    statusCode?: "potential" | "following" | "opportunity" | "won" | "lost";
    sourceId?: number;
    level?: string;
    type?: string;
    industry?: string;
    ownerUserId?: number;
    collaboratorId?: number;
    poolStatus?: string;
    tagIds?: number[];
    createdFrom?: string;
    createdTo?: string;
    lastFollowUpFrom?: string;
    lastFollowUpTo?: string;
    nextFollowUpFrom?: string;
    nextFollowUpTo?: string;
    sortBy?:
      | "name"
      | "createdAt"
      | "updatedAt"
      | "lastFollowUpAt"
      | "nextFollowUpAt"
      | "level";
    sortOrder?: "asc" | "desc";
  };

type crmCustomersDetailParams = {
    id: number;
  };

type crmCustomersDeleteParams = {
    id: number;
  };

type crmCustomersUpdateParams = {
    id: number;
  };

type crmCustomerActivitiesListParams = {
    customerId: number;
  };

type crmCustomerActivitiesCreateParams = {
    customerId: number;
  };

type crmCustomersClaimParams = {
    id: number;
  };

type crmCustomerContactsListParams = {
    customerId: number;
  };

type crmCustomerContactsCreateParams = {
    customerId: number;
  };

type crmCustomerMembersListParams = {
    id: number;
  };

type crmCustomerMembersAddParams = {
    id: number;
  };

type crmCustomerMembersRemoveParams = {
    id: number;
    userId: number;
  };

type crmCustomersPurgeParams = {
    id: number;
  };

type crmCustomersTransitionRelationshipStatusParams = {
    id: number;
  };

type crmCustomersReleaseParams = {
    id: number;
  };

type crmCustomersRestoreParams = {
    id: number;
  };

type crmCustomersTransferParams = {
    id: number;
  };

type crmCustomersTransfersParams = {
    id: number;
  };

type crmCustomersTrashListParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    view?:
      | "all"
      | "important"
      | "mine"
      | "collaborating"
      | "pending"
      | "stale7d"
      | "pool";
    statusCode?: "potential" | "following" | "opportunity" | "won" | "lost";
    sourceId?: number;
    level?: string;
    type?: string;
    industry?: string;
    ownerUserId?: number;
    collaboratorId?: number;
    poolStatus?: string;
    tagIds?: number[];
    createdFrom?: string;
    createdTo?: string;
    lastFollowUpFrom?: string;
    lastFollowUpTo?: string;
    nextFollowUpFrom?: string;
    nextFollowUpTo?: string;
    sortBy?:
      | "name"
      | "createdAt"
      | "updatedAt"
      | "lastFollowUpAt"
      | "nextFollowUpAt"
      | "level";
    sortOrder?: "asc" | "desc";
  };

type crmDirectCloseRevokeParams = {
    id: number;
  };

type getCrmV1OpportunitiesParams = {
    page?: number;
    pageSize?: number;
    keyword?: string & string;
    customerId?: number;
    primaryContactId?: number;
    stage?:
      | "needs_confirmation"
      | "solution"
      | "quotation"
      | "negotiation"
      | "won"
      | "lost";
    ownerId?: number;
    expectedCloseFrom?: string;
    expectedCloseTo?: string;
  };

type getCrmV1OpportunitiesIdParams = {
    id: number;
  };

type deleteCrmV1OpportunitiesIdParams = {
    id: number;
  };

type patchCrmV1OpportunitiesIdParams = {
    id: number;
  };

type postCrmV1OpportunitiesIdAdvanceParams = {
    id: number;
  };

type postCrmV1OpportunitiesIdLostParams = {
    id: number;
  };

type postCrmV1OpportunitiesIdWonParams = {
    id: number;
  };

type getCrmV1OpportunitiesDuplicateCheckParams = {
    customerId: number;
    name: string;
  };

type getCrmV1PaymentsParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    contractId?: number;
    customerId?: number;
    methodCode?: string;
    paidFrom?: string;
    paidTo?: string;
  };

type deleteCrmV1PaymentsIdParams = {
    id: number;
  };

type patchCrmV1PaymentsIdParams = {
    id: number;
  };

type getCrmV1PaymentsContractsContractIdParams = {
    contractId: number;
  };

type postCrmV1PaymentsContractsContractIdParams = {
    contractId: number;
  };

type crmPoolListParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    view?:
      | "all"
      | "important"
      | "mine"
      | "collaborating"
      | "pending"
      | "stale7d"
      | "pool";
    statusCode?: "potential" | "following" | "opportunity" | "won" | "lost";
    sourceId?: number;
    level?: string;
    type?: string;
    industry?: string;
    ownerUserId?: number;
    collaboratorId?: number;
    poolStatus?: string;
    tagIds?: number[];
    createdFrom?: string;
    createdTo?: string;
    lastFollowUpFrom?: string;
    lastFollowUpTo?: string;
    nextFollowUpFrom?: string;
    nextFollowUpTo?: string;
    sortBy?:
      | "name"
      | "createdAt"
      | "updatedAt"
      | "lastFollowUpAt"
      | "nextFollowUpAt"
      | "level";
    sortOrder?: "asc" | "desc";
  };

type crmProductsListParams = {
    page?: number;
    pageSize?: number;
    keyword?: string & string;
    categoryCode?: string;
    enabled?: number;
    includeDisabled?: boolean;
  };

type crmProductsDetailParams = {
    id: number;
  };

type crmProductsDeleteParams = {
    id: number;
  };

type crmProductsUpdateParams = {
    id: number;
  };

type crmProductsDisableParams = {
    id: number;
  };

type crmProductsEnableParams = {
    id: number;
  };

type crmProductCategoriesListParams = {
    page?: number;
    pageSize?: number;
    keyword?: string & string;
    enabled?: number;
    includeDisabled?: boolean;
  };

type crmProductCategoriesDeleteParams = {
    id: number;
  };

type crmProductCategoriesUpdateParams = {
    id: number;
  };

type crmProductUnitsListParams = {
    page?: number;
    pageSize?: number;
    keyword?: string & string;
    enabled?: number;
    includeDisabled?: boolean;
  };

type crmProductUnitsDeleteParams = {
    id: number;
  };

type crmProductUnitsUpdateParams = {
    id: number;
  };

type crmPublicQuoteGetParams = {
    token: string;
  };

type crmQuotationsListParams = {
    page?: number;
    pageSize?: number;
    keyword?: string & string;
    status?:
      | "draft"
      | "sent"
      | "accepted"
      | "rejected"
      | "voided"
      | "superseded";
    customerId?: number;
    opportunityId?: number;
    ownerUserId?: number;
  };

type crmQuotationsGetParams = {
    id: number;
  };

type crmQuotationsDeleteParams = {
    id: number;
  };

type crmQuotationsUpdateParams = {
    id: number;
  };

type crmQuotationsAcceptParams = {
    id: number;
  };

type crmQuotationsCreateContractParams = {
    id: number;
  };

type crmQuotationsPreviewParams = {
    id: number;
  };

type crmQuotationsRejectParams = {
    id: number;
  };

type crmQuotationsReviseParams = {
    id: number;
  };

type crmQuotationsRevokeConfirmationParams = {
    id: number;
  };

type crmQuotationsSendParams = {
    id: number;
  };

type crmQuotationsCreateShareParams = {
    id: number;
  };

type crmQuotationsRevokeShareParams = {
    id: number;
    shareId: number;
  };

type crmQuotationsStatusLogsParams = {
    id: number;
  };

type crmQuotationsVoidParams = {
    id: number;
  };

type crmQuotationsDuplicatesParams = {
    opportunityId: number;
    name: string;
  };

type crmSettingsSourcesListParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
  };

type crmSettingsSourcesDeleteParams = {
    id: number;
  };

type crmSettingsSourcesUpdateParams = {
    id: number;
  };

type crmSettingsTagsListParams = {
    page?: number;
    pageSize?: number;
    keyword?: string;
  };

type crmSettingsTagsDeleteParams = {
    id: number;
  };

type crmSettingsTagsUpdateParams = {
    id: number;
  };

type getCrmV1TasksParams = {
    page?: number;
    pageSize?: number;
    keyword?: string & string;
    customerId?: number;
    status?: "todo" | "in_progress" | "completed" | "cancelled";
    assigneeUserId?: number;
  };

type getCrmV1TasksIdParams = {
    id: number;
  };

type deleteCrmV1TasksIdParams = {
    id: number;
  };

type patchCrmV1TasksIdParams = {
    id: number;
  };

type crmVisitsListParams = {
    customerId?: number;
    plannedFrom?: string;
    plannedTo?: string;
    page?: number;
    pageSize?: number;
  };
}
