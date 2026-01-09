export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  InviteLogin: { token: string };
};

export type MainTabParamList = {
  Home: undefined;
  Jobs: undefined;
  Services: undefined;
  Notifications: undefined;
  Settings: undefined;
};

export type JobsStackParamList = {
  JobsList: undefined;
  JobDetail: { jobId: number };
  ReviewPrompt: { jobId: number };
};

export type ServicesStackParamList = {
  ServiceCatalog: undefined;
  RequestService: undefined;
  ServiceRequestDetail: { requestId: number };
};
