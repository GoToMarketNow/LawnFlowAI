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
  Crews: undefined;
  Messages: undefined;
  Payments: undefined;
  Notifications: undefined;
  Settings: undefined;
};

export type JobsStackParamList = {
  JobsList: undefined;
  JobDetail: { jobId: number };
  ReviewPrompt: { jobId: number };
  JobQA: { jobId: number };
};

export type ServicesStackParamList = {
  ServiceCatalog: undefined;
  RequestService: undefined;
  ServiceRequestDetail: { requestId: number };
};

export type CrewsStackParamList = {
  CrewsList: undefined;
  CrewDetail: { crewId: number };
  CrewSchedule: { crewId: number };
  CreateCrew: undefined;
  EditCrewSkills: { crewId: number };
  MemberDetail: { memberId: number };
};

export type MessagesStackParamList = {
  ThreadsList: undefined;
  Thread: { threadId: string; threadName: string };
};

export type PaymentsStackParamList = {
  PaymentMethods: undefined;
  PaymentHistory: undefined;
  PaymentDetail: { transactionId: string };
  AddCard: undefined;
  AddBank: undefined;
};

export type OwnerStackParamList = {
  OwnerDashboard: undefined;
  Agents: undefined;
  CreateJob: undefined;
  CreateCustomer: undefined;
  CreateQuote: undefined;
  Customers: undefined;
};
