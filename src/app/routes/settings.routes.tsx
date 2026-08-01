import type { RouteObject } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  ActivityLogsPage,
  DataResetSettingsPage,
  HeroSlideEditorPage,
  HeroSlidePreviewPage,
  SettingsPage,
  StoresPage,
  WebsiteContactTabPage,
  WebsiteHomepageTabPage,
  WebsiteSeoTabPage,
  WebsiteSettingsPage,
  WebsiteSocialTabPage,
  withSuspense,
} from './lazy'

export const settingsRoutes: RouteObject[] = [
  {
    element: <PermissionRoute permission="settings.manage" />,
    children: [{ path: '/settings', element: withSuspense(SettingsPage) }],
  },
  {
    element: <PermissionRoute permission="audit.read" />,
    children: [{ path: '/activity-logs', element: withSuspense(ActivityLogsPage) }],
  },
  {
    element: (
      <PermissionRoute
        permission={[
          'website.hero.read',
          'website.manage',
          'website.read',
          'settings.manage',
        ]}
      />
    ),
    children: [
      { path: '/settings/website', element: withSuspense(WebsiteSettingsPage) },
      { path: '/settings/website/homepage', element: withSuspense(WebsiteHomepageTabPage) },
      { path: '/settings/website/seo', element: withSuspense(WebsiteSeoTabPage) },
      { path: '/settings/website/social', element: withSuspense(WebsiteSocialTabPage) },
      { path: '/settings/website/contact', element: withSuspense(WebsiteContactTabPage) },
      { path: '/settings/website/hero/new', element: withSuspense(HeroSlideEditorPage) },
      { path: '/settings/website/hero/:id/preview', element: withSuspense(HeroSlidePreviewPage) },
      { path: '/settings/website/hero/:id', element: withSuspense(HeroSlideEditorPage) },
    ],
  },
  {
    element: <PermissionRoute permission="settings.data_reset" />,
    children: [{ path: '/settings/data-reset', element: withSuspense(DataResetSettingsPage) }],
  },
  {
    element: <PermissionRoute permission={['stores.read', 'stores.manage', 'settings.manage']} />,
    children: [{ path: '/stores', element: withSuspense(StoresPage) }],
  },
]
