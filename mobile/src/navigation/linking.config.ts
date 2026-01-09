export const linking = {
  prefixes: ['lawnflow://', 'https://app.lawnflow.ai'],
  config: {
    screens: {
      Auth: {
        screens: {
          InviteLogin: 'invite/:token',
        },
      },
      Main: {
        screens: {
          Home: 'home',
          Jobs: {
            screens: {
              JobsList: 'jobs',
              JobDetail: 'job/:jobId',
              ReviewPrompt: 'review/:jobId',
            },
          },
          Services: {
            screens: {
              ServiceCatalog: 'request-service',
              RequestService: 'request-service/form',
              ServiceRequestDetail: 'service-request/:requestId',
            },
          },
          Notifications: 'notifications',
          Settings: 'settings',
        },
      },
    },
  },
};
