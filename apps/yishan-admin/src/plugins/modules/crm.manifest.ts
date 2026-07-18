const crmManifest = {
  name: 'crm',
  version: '1.0.0',
  coreCompatibility: '^6.0.0',
  routes: [
    {
      path: '/plugins/iximei/crm/hospitals',
      component: './crm/hospitals',
      access: 'canDo',
    },
    {
      path: '/plugins/iximei/crm/customers',
      component: './crm/customers',
      access: 'canDo',
    },
    {
      path: '/plugins/iximei/crm/members',
      component: './crm/members',
      access: 'canDo',
    },
    {
      path: '/plugins/iximei/crm/dispatches',
      component: './crm/dispatches',
      access: 'canDo',
    },
  ],
};

export default crmManifest;

