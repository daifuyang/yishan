import type { ResourceSpec } from './types.js'

export const generatedResources: ResourceSpec[] = [
  {
    "resource": "apps",
    "description": "Generated from OpenAPI",
    "endpoints": {
      "list": {
        "method": "GET",
        "path": "/api/v1/admin/apps/",
        "requireId": false
      },
      "create": {
        "method": "POST",
        "path": "/api/v1/admin/apps/",
        "requireId": false
      },
      "detail": {
        "method": "GET",
        "path": "/api/v1/admin/apps/:id",
        "requireId": true
      },
      "update": {
        "method": "PUT",
        "path": "/api/v1/admin/apps/:id",
        "requireId": true
      },
      "delete": {
        "method": "DELETE",
        "path": "/api/v1/admin/apps/:id",
        "requireId": true
      }
    }
  },
  {
    "resource": "attachments",
    "description": "Generated from OpenAPI",
    "endpoints": {
      "list": {
        "method": "GET",
        "path": "/api/v1/admin/attachments/",
        "requireId": false
      },
      "delete": {
        "method": "DELETE",
        "path": "/api/v1/admin/attachments/:id",
        "requireId": true
      },
      "create": {
        "method": "POST",
        "path": "/api/v1/admin/attachments/",
        "requireId": false
      },
      "detail": {
        "method": "GET",
        "path": "/api/v1/admin/attachments/:id",
        "requireId": true
      },
      "update": {
        "method": "PUT",
        "path": "/api/v1/admin/attachments/:id",
        "requireId": true
      }
    }
  },
  {
    "resource": "departments",
    "description": "Generated from OpenAPI",
    "endpoints": {
      "list": {
        "method": "GET",
        "path": "/api/v1/admin/departments/",
        "requireId": false
      },
      "create": {
        "method": "POST",
        "path": "/api/v1/admin/departments/",
        "requireId": false
      },
      "detail": {
        "method": "GET",
        "path": "/api/v1/admin/departments/:id",
        "requireId": true
      },
      "update": {
        "method": "PUT",
        "path": "/api/v1/admin/departments/:id",
        "requireId": true
      },
      "delete": {
        "method": "DELETE",
        "path": "/api/v1/admin/departments/:id",
        "requireId": true
      }
    }
  },
  {
    "resource": "hello.me",
    "description": "Generated from OpenAPI",
    "endpoints": {
      "list": {
        "method": "GET",
        "path": "/api/modules/hello/v1/admin/me/",
        "requireId": false
      }
    }
  },
  {
    "resource": "menus",
    "description": "Generated from OpenAPI",
    "endpoints": {
      "list": {
        "method": "GET",
        "path": "/api/v1/admin/menus/",
        "requireId": false
      },
      "create": {
        "method": "POST",
        "path": "/api/v1/admin/menus/",
        "requireId": false
      },
      "detail": {
        "method": "GET",
        "path": "/api/v1/admin/menus/:id",
        "requireId": true
      },
      "update": {
        "method": "PUT",
        "path": "/api/v1/admin/menus/:id",
        "requireId": true
      },
      "delete": {
        "method": "DELETE",
        "path": "/api/v1/admin/menus/:id",
        "requireId": true
      }
    }
  },
  {
    "resource": "portal.articles",
    "description": "Generated from OpenAPI",
    "endpoints": {
      "list": {
        "method": "GET",
        "path": "/api/modules/portal/v1/admin/articles/",
        "requireId": false
      },
      "create": {
        "method": "POST",
        "path": "/api/modules/portal/v1/admin/articles/",
        "requireId": false
      },
      "detail": {
        "method": "GET",
        "path": "/api/modules/portal/v1/admin/articles/:id",
        "requireId": true
      },
      "update": {
        "method": "PUT",
        "path": "/api/modules/portal/v1/admin/articles/:id",
        "requireId": true
      },
      "delete": {
        "method": "DELETE",
        "path": "/api/modules/portal/v1/admin/articles/:id",
        "requireId": true
      }
    }
  },
  {
    "resource": "portal.pages",
    "description": "Generated from OpenAPI",
    "endpoints": {
      "list": {
        "method": "GET",
        "path": "/api/modules/portal/v1/admin/pages/",
        "requireId": false
      },
      "create": {
        "method": "POST",
        "path": "/api/modules/portal/v1/admin/pages/",
        "requireId": false
      },
      "detail": {
        "method": "GET",
        "path": "/api/modules/portal/v1/admin/pages/:id",
        "requireId": true
      },
      "update": {
        "method": "PUT",
        "path": "/api/modules/portal/v1/admin/pages/:id",
        "requireId": true
      },
      "delete": {
        "method": "DELETE",
        "path": "/api/modules/portal/v1/admin/pages/:id",
        "requireId": true
      }
    }
  },
  {
    "resource": "portal.posts",
    "description": "Generated from OpenAPI",
    "endpoints": {
      "list": {
        "method": "GET",
        "path": "/api/modules/portal/v1/admin/posts/",
        "requireId": false
      },
      "create": {
        "method": "POST",
        "path": "/api/modules/portal/v1/admin/posts/",
        "requireId": false
      },
      "detail": {
        "method": "GET",
        "path": "/api/modules/portal/v1/admin/posts/:id",
        "requireId": true
      },
      "update": {
        "method": "PUT",
        "path": "/api/modules/portal/v1/admin/posts/:id",
        "requireId": true
      },
      "delete": {
        "method": "DELETE",
        "path": "/api/modules/portal/v1/admin/posts/:id",
        "requireId": true
      }
    }
  },
  {
    "resource": "roles",
    "description": "Generated from OpenAPI",
    "endpoints": {
      "list": {
        "method": "GET",
        "path": "/api/v1/admin/roles/",
        "requireId": false
      },
      "create": {
        "method": "POST",
        "path": "/api/v1/admin/roles/",
        "requireId": false
      },
      "detail": {
        "method": "GET",
        "path": "/api/v1/admin/roles/:id",
        "requireId": true
      },
      "update": {
        "method": "PUT",
        "path": "/api/v1/admin/roles/:id",
        "requireId": true
      },
      "delete": {
        "method": "DELETE",
        "path": "/api/v1/admin/roles/:id",
        "requireId": true
      }
    }
  },
  {
    "resource": "users",
    "description": "Generated from OpenAPI",
    "endpoints": {
      "list": {
        "method": "GET",
        "path": "/api/v1/admin/users/",
        "requireId": false
      },
      "create": {
        "method": "POST",
        "path": "/api/v1/admin/users/",
        "requireId": false
      },
      "detail": {
        "method": "GET",
        "path": "/api/v1/admin/users/:id",
        "requireId": true
      },
      "update": {
        "method": "PUT",
        "path": "/api/v1/admin/users/:id",
        "requireId": true
      },
      "delete": {
        "method": "DELETE",
        "path": "/api/v1/admin/users/:id",
        "requireId": true
      }
    }
  }
]
