import type { Schema, Attribute } from '@strapi/strapi';

export interface AdminPermission extends Schema.CollectionType {
  collectionName: 'admin_permissions';
  info: {
    name: 'Permission';
    description: '';
    singularName: 'permission';
    pluralName: 'permissions';
    displayName: 'Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Attribute.JSON & Attribute.DefaultTo<{}>;
    subject: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    properties: Attribute.JSON & Attribute.DefaultTo<{}>;
    conditions: Attribute.JSON & Attribute.DefaultTo<[]>;
    role: Attribute.Relation<'admin::permission', 'manyToOne', 'admin::role'>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminUser extends Schema.CollectionType {
  collectionName: 'admin_users';
  info: {
    name: 'User';
    description: '';
    singularName: 'user';
    pluralName: 'users';
    displayName: 'User';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    firstname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastname: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    username: Attribute.String;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.Private &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    resetPasswordToken: Attribute.String & Attribute.Private;
    registrationToken: Attribute.String & Attribute.Private;
    isActive: Attribute.Boolean &
      Attribute.Private &
      Attribute.DefaultTo<false>;
    roles: Attribute.Relation<'admin::user', 'manyToMany', 'admin::role'> &
      Attribute.Private;
    blocked: Attribute.Boolean & Attribute.Private & Attribute.DefaultTo<false>;
    preferedLanguage: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'admin::user', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface AdminRole extends Schema.CollectionType {
  collectionName: 'admin_roles';
  info: {
    name: 'Role';
    description: '';
    singularName: 'role';
    pluralName: 'roles';
    displayName: 'Role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    code: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String;
    users: Attribute.Relation<'admin::role', 'manyToMany', 'admin::user'>;
    permissions: Attribute.Relation<
      'admin::role',
      'oneToMany',
      'admin::permission'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'admin::role', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface AdminApiToken extends Schema.CollectionType {
  collectionName: 'strapi_api_tokens';
  info: {
    name: 'Api Token';
    singularName: 'api-token';
    pluralName: 'api-tokens';
    displayName: 'Api Token';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    type: Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Attribute.Required &
      Attribute.DefaultTo<'read-only'>;
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastUsedAt: Attribute.DateTime;
    permissions: Attribute.Relation<
      'admin::api-token',
      'oneToMany',
      'admin::api-token-permission'
    >;
    expiresAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::api-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_api_token_permissions';
  info: {
    name: 'API Token Permission';
    description: '';
    singularName: 'api-token-permission';
    pluralName: 'api-token-permissions';
    displayName: 'API Token Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    token: Attribute.Relation<
      'admin::api-token-permission',
      'manyToOne',
      'admin::api-token'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::api-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminTransferToken extends Schema.CollectionType {
  collectionName: 'strapi_transfer_tokens';
  info: {
    name: 'Transfer Token';
    singularName: 'transfer-token';
    pluralName: 'transfer-tokens';
    displayName: 'Transfer Token';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    description: Attribute.String &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Attribute.DefaultTo<''>;
    accessKey: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    lastUsedAt: Attribute.DateTime;
    permissions: Attribute.Relation<
      'admin::transfer-token',
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    expiresAt: Attribute.DateTime;
    lifespan: Attribute.BigInteger;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::transfer-token',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface AdminTransferTokenPermission extends Schema.CollectionType {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    name: 'Transfer Token Permission';
    description: '';
    singularName: 'transfer-token-permission';
    pluralName: 'transfer-token-permissions';
    displayName: 'Transfer Token Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    token: Attribute.Relation<
      'admin::transfer-token-permission',
      'manyToOne',
      'admin::transfer-token'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'admin::transfer-token-permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUploadFile extends Schema.CollectionType {
  collectionName: 'files';
  info: {
    singularName: 'file';
    pluralName: 'files';
    displayName: 'File';
    description: '';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    alternativeText: Attribute.String;
    caption: Attribute.String;
    width: Attribute.Integer;
    height: Attribute.Integer;
    formats: Attribute.JSON;
    hash: Attribute.String & Attribute.Required;
    ext: Attribute.String;
    mime: Attribute.String & Attribute.Required;
    size: Attribute.Decimal & Attribute.Required;
    url: Attribute.String & Attribute.Required;
    previewUrl: Attribute.String;
    provider: Attribute.String & Attribute.Required;
    provider_metadata: Attribute.JSON;
    related: Attribute.Relation<'plugin::upload.file', 'morphToMany'>;
    folder: Attribute.Relation<
      'plugin::upload.file',
      'manyToOne',
      'plugin::upload.folder'
    > &
      Attribute.Private;
    folderPath: Attribute.String &
      Attribute.Required &
      Attribute.Private &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::upload.file',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUploadFolder extends Schema.CollectionType {
  collectionName: 'upload_folders';
  info: {
    singularName: 'folder';
    pluralName: 'folders';
    displayName: 'Folder';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    pathId: Attribute.Integer & Attribute.Required & Attribute.Unique;
    parent: Attribute.Relation<
      'plugin::upload.folder',
      'manyToOne',
      'plugin::upload.folder'
    >;
    children: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.folder'
    >;
    files: Attribute.Relation<
      'plugin::upload.folder',
      'oneToMany',
      'plugin::upload.file'
    >;
    path: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::upload.folder',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesRelease extends Schema.CollectionType {
  collectionName: 'strapi_releases';
  info: {
    singularName: 'release';
    pluralName: 'releases';
    displayName: 'Release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String & Attribute.Required;
    releasedAt: Attribute.DateTime;
    scheduledAt: Attribute.DateTime;
    timezone: Attribute.String;
    status: Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Attribute.Required;
    actions: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Schema.CollectionType {
  collectionName: 'strapi_release_actions';
  info: {
    singularName: 'release-action';
    pluralName: 'release-actions';
    displayName: 'Release Action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    type: Attribute.Enumeration<['publish', 'unpublish']> & Attribute.Required;
    entry: Attribute.Relation<
      'plugin::content-releases.release-action',
      'morphToOne'
    >;
    contentType: Attribute.String & Attribute.Required;
    locale: Attribute.String;
    release: Attribute.Relation<
      'plugin::content-releases.release-action',
      'manyToOne',
      'plugin::content-releases.release'
    >;
    isEntryValid: Attribute.Boolean;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::content-releases.release-action',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginI18NLocale extends Schema.CollectionType {
  collectionName: 'i18n_locale';
  info: {
    singularName: 'locale';
    pluralName: 'locales';
    collectionName: 'locales';
    displayName: 'Locale';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.SetMinMax<
        {
          min: 1;
          max: 50;
        },
        number
      >;
    code: Attribute.String & Attribute.Unique;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::i18n.locale',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::i18n.locale',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Schema.CollectionType {
  collectionName: 'up_permissions';
  info: {
    name: 'permission';
    description: '';
    singularName: 'permission';
    pluralName: 'permissions';
    displayName: 'Permission';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Attribute.String & Attribute.Required;
    role: Attribute.Relation<
      'plugin::users-permissions.permission',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.permission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole extends Schema.CollectionType {
  collectionName: 'up_roles';
  info: {
    name: 'role';
    description: '';
    singularName: 'role';
    pluralName: 'roles';
    displayName: 'Role';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    name: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    description: Attribute.String;
    type: Attribute.String & Attribute.Unique;
    permissions: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    users: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToMany',
      'plugin::users-permissions.user'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.role',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface PluginUsersPermissionsUser extends Schema.CollectionType {
  collectionName: 'up_users';
  info: {
    name: 'user';
    description: '';
    singularName: 'user';
    pluralName: 'users';
    displayName: 'User';
  };
  options: {
    draftAndPublish: false;
    timestamps: true;
  };
  attributes: {
    username: Attribute.String &
      Attribute.Required &
      Attribute.Unique &
      Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    email: Attribute.Email &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Attribute.String;
    password: Attribute.Password &
      Attribute.Private &
      Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    resetPasswordToken: Attribute.String & Attribute.Private;
    confirmationToken: Attribute.String & Attribute.Private;
    confirmed: Attribute.Boolean & Attribute.DefaultTo<false>;
    blocked: Attribute.Boolean & Attribute.DefaultTo<false>;
    role: Attribute.Relation<
      'plugin::users-permissions.user',
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'plugin::users-permissions.user',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiBlogAuthorBlogAuthor extends Schema.CollectionType {
  collectionName: 'blog_authors';
  info: {
    singularName: 'blog-author';
    pluralName: 'blog-authors';
    displayName: 'BlogAuthor';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    name: Attribute.String;
    role: Attribute.String;
    posts: Attribute.Relation<
      'api::blog-author.blog-author',
      'oneToMany',
      'api::blog-post.blog-post'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::blog-author.blog-author',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::blog-author.blog-author',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiBlogPostBlogPost extends Schema.CollectionType {
  collectionName: 'blog_posts';
  info: {
    singularName: 'blog-post';
    pluralName: 'blog-posts';
    displayName: 'BlogPost';
    description: '';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    title: Attribute.String;
    slug: Attribute.String;
    metadata: Attribute.Component<'meta.metadata'>;
    author: Attribute.Relation<
      'api::blog-post.blog-post',
      'manyToOne',
      'api::blog-author.blog-author'
    >;
    date: Attribute.Date;
    image: Attribute.Media;
    preview: Attribute.RichText;
    content: Attribute.RichText;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    publishedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::blog-post.blog-post',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::blog-post.blog-post',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiCauseCause extends Schema.CollectionType {
  collectionName: 'causes';
  info: {
    singularName: 'cause';
    pluralName: 'causes';
    displayName: 'Cause';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    title: Attribute.String;
    slug: Attribute.String & Attribute.Unique;
    metadata: Attribute.Component<'meta.metadata'>;
    introduction: Attribute.RichText;
    content: Attribute.RichText;
    organizations: Attribute.Relation<
      'api::cause.cause',
      'oneToMany',
      'api::organization.organization'
    >;
    image: Attribute.Media;
    active: Attribute.Boolean & Attribute.DefaultTo<true>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::cause.cause',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::cause.cause',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiContactSubmissionContactSubmission
  extends Schema.CollectionType {
  collectionName: 'contact_submissions';
  info: {
    singularName: 'contact-submission';
    pluralName: 'contact-submissions';
    displayName: 'ContactSubmission';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    name: Attribute.String;
    email: Attribute.Email;
    message: Attribute.Text &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        maxLength: 1024;
      }>;
    responded: Attribute.Boolean & Attribute.DefaultTo<false>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::contact-submission.contact-submission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::contact-submission.contact-submission',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiDonationDonation extends Schema.CollectionType {
  collectionName: 'donations';
  info: {
    singularName: 'donation';
    pluralName: 'donations';
    displayName: 'Donation';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    donor: Attribute.Relation<
      'api::donation.donation',
      'manyToOne',
      'api::donor.donor'
    >;
    recurringDonation: Attribute.Relation<
      'api::donation.donation',
      'manyToOne',
      'api::recurring-donation.recurring-donation'
    >;
    datetime: Attribute.DateTime;
    amount: Attribute.Integer;
    finalized: Attribute.Boolean & Attribute.DefaultTo<false>;
    paymentMethod: Attribute.String;
    iban: Attribute.String;
    comment: Attribute.Text;
    companyName: Attribute.String &
      Attribute.SetMinMaxLength<{
        maxLength: 128;
      }>;
    companyCode: Attribute.String &
      Attribute.SetMinMaxLength<{
        maxLength: 128;
      }>;
    organizationDonations: Attribute.Relation<
      'api::donation.donation',
      'oneToMany',
      'api::organization-donation.organization-donation'
    >;
    tipSize: Attribute.Float;
    tipAmount: Attribute.Integer;
    sentToOrganization: Attribute.Boolean & Attribute.DefaultTo<false>;
    dedicationName: Attribute.String &
      Attribute.SetMinMaxLength<{
        maxLength: 128;
      }>;
    dedicationEmail: Attribute.String &
      Attribute.SetMinMaxLength<{
        maxLength: 256;
      }>;
    dedicationMessage: Attribute.Text &
      Attribute.SetMinMaxLength<{
        maxLength: 1024;
      }>;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::donation.donation',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::donation.donation',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiDonationInfoDonationInfo extends Schema.SingleType {
  collectionName: 'donation_infos';
  info: {
    singularName: 'donation-info';
    pluralName: 'donation-infos';
    displayName: 'DonationInfo';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    returnPath: Attribute.String & Attribute.DefaultTo<'annetatud'>;
    transactionComment: Attribute.String &
      Attribute.DefaultTo<'Anneta Targalt annetus'>;
    iban: Attribute.String;
    recipient: Attribute.String;
    recurringPaymentComment: Attribute.String;
    merchantReferencePrefix: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::donation-info.donation-info',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::donation-info.donation-info',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiDonorDonor extends Schema.CollectionType {
  collectionName: 'donors';
  info: {
    singularName: 'donor';
    pluralName: 'donors';
    displayName: 'Donor';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    idCode: Attribute.String &
      Attribute.Required &
      Attribute.SetMinMaxLength<{
        minLength: 11;
        maxLength: 11;
      }>;
    firstName: Attribute.String &
      Attribute.SetMinMaxLength<{
        maxLength: 128;
      }>;
    lastName: Attribute.String &
      Attribute.SetMinMaxLength<{
        maxLength: 128;
      }>;
    email: Attribute.Email &
      Attribute.SetMinMaxLength<{
        maxLength: 256;
      }>;
    recurringDonor: Attribute.Boolean;
    donations: Attribute.Relation<
      'api::donor.donor',
      'oneToMany',
      'api::donation.donation'
    >;
    recurringDonations: Attribute.Relation<
      'api::donor.donor',
      'oneToMany',
      'api::recurring-donation.recurring-donation'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::donor.donor',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::donor.donor',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiEmailConfigEmailConfig extends Schema.SingleType {
  collectionName: 'email_configs';
  info: {
    singularName: 'email-config';
    pluralName: 'email-configs';
    displayName: 'EmailConfig';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    confirmationSubject: Attribute.String;
    confirmationText: Attribute.Text;
    confirmationHtml: Attribute.Text;
    confirmationReplyTo: Attribute.Email;
    contactFormSubmissionText: Attribute.Text;
    contactFormSubmissionHtml: Attribute.Text;
    contactFormSubmissionRecipients: Attribute.Text;
    contactFormSubmissionSubject: Attribute.String;
    dedicationSubject: Attribute.String;
    dedicationText: Attribute.Text;
    dedicationHtml: Attribute.Text;
    dedicationMessageText: Attribute.Text;
    dedicationMessageHtml: Attribute.Text;
    recurringConfirmationText: Attribute.Text;
    recurringConfirmationHtml: Attribute.Text;
    recurringConfirmationSubject: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::email-config.email-config',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::email-config.email-config',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiGlobalGlobal extends Schema.SingleType {
  collectionName: 'globals';
  info: {
    singularName: 'global';
    pluralName: 'globals';
    displayName: 'Global';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    title: Attribute.String;
    metadata: Attribute.Component<'meta.metadata'>;
    favicon16: Attribute.Media;
    favicon32: Attribute.Media;
    chromeIcon192: Attribute.Media;
    chromeIcon512: Attribute.Media;
    appleTouchIcon: Attribute.Media;
    navbar: Attribute.Component<'meta.navbar'>;
    footer: Attribute.Component<'meta.footer'>;
    notFoundPage: Attribute.Component<'meta.not-found-page'>;
    backWord: Attribute.String;
    donateLink: Attribute.String;
    closeText: Attribute.String;
    errorText: Attribute.String;
    totalText: Attribute.String;
    currency: Attribute.String & Attribute.DefaultTo<'\u20AC'>;
    tipOrganization: Attribute.String;
    dateLocale: Attribute.Enumeration<['et-EE']>;
    blogSlug: Attribute.String;
    donateText: Attribute.String;
    readMoreText: Attribute.String;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::global.global',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::global.global',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiOrganizationOrganization extends Schema.CollectionType {
  collectionName: 'organizations';
  info: {
    singularName: 'organization';
    pluralName: 'organizations';
    displayName: 'Organization';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    title: Attribute.String;
    slug: Attribute.String & Attribute.Unique;
    metadata: Attribute.Component<'meta.metadata'>;
    fund: Attribute.Boolean & Attribute.DefaultTo<false>;
    homepage: Attribute.String;
    introduction: Attribute.RichText;
    content: Attribute.RichText;
    cause: Attribute.Relation<
      'api::organization.organization',
      'manyToOne',
      'api::cause.cause'
    >;
    logo: Attribute.Media;
    active: Attribute.Boolean & Attribute.DefaultTo<true>;
    organizationDonations: Attribute.Relation<
      'api::organization.organization',
      'oneToMany',
      'api::organization-donation.organization-donation'
    >;
    organizationRecurringDonations: Attribute.Relation<
      'api::organization.organization',
      'oneToMany',
      'api::organization-recurring-donation.organization-recurring-donation'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::organization.organization',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::organization.organization',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiOrganizationDonationOrganizationDonation
  extends Schema.CollectionType {
  collectionName: 'organization_donations';
  info: {
    singularName: 'organization-donation';
    pluralName: 'organization-donations';
    displayName: 'OrganizationDonation';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    donation: Attribute.Relation<
      'api::organization-donation.organization-donation',
      'manyToOne',
      'api::donation.donation'
    >;
    organization: Attribute.Relation<
      'api::organization-donation.organization-donation',
      'manyToOne',
      'api::organization.organization'
    >;
    proportion: Attribute.Float;
    amount: Attribute.Integer;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::organization-donation.organization-donation',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::organization-donation.organization-donation',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiOrganizationRecurringDonationOrganizationRecurringDonation
  extends Schema.CollectionType {
  collectionName: 'organization_recurring_donations';
  info: {
    singularName: 'organization-recurring-donation';
    pluralName: 'organization-recurring-donations';
    displayName: 'OrganizationRecurringDonation';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    recurringDonation: Attribute.Relation<
      'api::organization-recurring-donation.organization-recurring-donation',
      'manyToOne',
      'api::recurring-donation.recurring-donation'
    >;
    organization: Attribute.Relation<
      'api::organization-recurring-donation.organization-recurring-donation',
      'manyToOne',
      'api::organization.organization'
    >;
    proportion: Attribute.Float;
    amount: Attribute.Integer;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::organization-recurring-donation.organization-recurring-donation',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::organization-recurring-donation.organization-recurring-donation',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiPagePage extends Schema.CollectionType {
  collectionName: 'pages';
  info: {
    singularName: 'page';
    pluralName: 'pages';
    displayName: 'Page';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    name: Attribute.String;
    slug: Attribute.String & Attribute.Unique;
    metadata: Attribute.Component<'meta.metadata'>;
    sections: Attribute.DynamicZone<
      [
        'sections.hero-section',
        'sections.text-section',
        'sections.cta-section',
        'sections.header-section',
        'sections.causes-section',
        'sections.donation-section',
        'sections.thank-you-section',
        'sections.power-section',
        'sections.team-section',
        'sections.testimonials-section',
        'sections.contact-section',
        'sections.faq-section',
        'sections.stats-section',
        'sections.campaign-section',
        'sections.redirect-section',
        'sections.blog-posts-section',
        'sections.organizations-section',
        'sections.partner-section'
      ]
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<'api::page.page', 'oneToOne', 'admin::user'> &
      Attribute.Private;
    updatedBy: Attribute.Relation<'api::page.page', 'oneToOne', 'admin::user'> &
      Attribute.Private;
  };
}

export interface ApiRecurringDonationRecurringDonation
  extends Schema.CollectionType {
  collectionName: 'recurring_donations';
  info: {
    singularName: 'recurring-donation';
    pluralName: 'recurring-donations';
    displayName: 'RecurringDonation';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    active: Attribute.Boolean;
    companyName: Attribute.String;
    companyCode: Attribute.String;
    comment: Attribute.Text;
    bank: Attribute.String;
    amount: Attribute.Integer;
    organizationRecurringDonations: Attribute.Relation<
      'api::recurring-donation.recurring-donation',
      'oneToMany',
      'api::organization-recurring-donation.organization-recurring-donation'
    >;
    tipSize: Attribute.Float;
    tipAmount: Attribute.Integer;
    datetime: Attribute.DateTime;
    donations: Attribute.Relation<
      'api::recurring-donation.recurring-donation',
      'oneToMany',
      'api::donation.donation'
    >;
    donor: Attribute.Relation<
      'api::recurring-donation.recurring-donation',
      'manyToOne',
      'api::donor.donor'
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::recurring-donation.recurring-donation',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::recurring-donation.recurring-donation',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

export interface ApiSpecialPageSpecialPage extends Schema.CollectionType {
  collectionName: 'special_pages';
  info: {
    singularName: 'special-page';
    pluralName: 'special-pages';
    displayName: 'SpecialPage';
    description: '';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    name: Attribute.String;
    slugPattern: Attribute.String;
    collectionType: Attribute.String;
    sections: Attribute.DynamicZone<
      [
        'sections.cta-section',
        'sections.header-section',
        'sections.hero-section',
        'sections.text-section',
        'special-sections.special-header-section',
        'sections.causes-section',
        'special-sections.cause-organizations-section',
        'special-sections.entity-text-section',
        'special-sections.org-header-section',
        'special-sections.organization-cta-section',
        'special-sections.blog-header-section'
      ]
    >;
    createdAt: Attribute.DateTime;
    updatedAt: Attribute.DateTime;
    createdBy: Attribute.Relation<
      'api::special-page.special-page',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
    updatedBy: Attribute.Relation<
      'api::special-page.special-page',
      'oneToOne',
      'admin::user'
    > &
      Attribute.Private;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface ContentTypes {
      'admin::permission': AdminPermission;
      'admin::user': AdminUser;
      'admin::role': AdminRole;
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
      'api::blog-author.blog-author': ApiBlogAuthorBlogAuthor;
      'api::blog-post.blog-post': ApiBlogPostBlogPost;
      'api::cause.cause': ApiCauseCause;
      'api::contact-submission.contact-submission': ApiContactSubmissionContactSubmission;
      'api::donation.donation': ApiDonationDonation;
      'api::donation-info.donation-info': ApiDonationInfoDonationInfo;
      'api::donor.donor': ApiDonorDonor;
      'api::email-config.email-config': ApiEmailConfigEmailConfig;
      'api::global.global': ApiGlobalGlobal;
      'api::organization.organization': ApiOrganizationOrganization;
      'api::organization-donation.organization-donation': ApiOrganizationDonationOrganizationDonation;
      'api::organization-recurring-donation.organization-recurring-donation': ApiOrganizationRecurringDonationOrganizationRecurringDonation;
      'api::page.page': ApiPagePage;
      'api::recurring-donation.recurring-donation': ApiRecurringDonationRecurringDonation;
      'api::special-page.special-page': ApiSpecialPageSpecialPage;
    }
  }
}
