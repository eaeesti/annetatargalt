import type { Schema, Attribute } from '@strapi/strapi';

export interface MetaMetadata extends Schema.Component {
  collectionName: 'components_meta_metadata';
  info: {
    displayName: 'Metadata';
    icon: 'medium';
  };
  attributes: {
    title: Attribute.String;
    description: Attribute.Text;
    shareImage: Attribute.Media;
  };
}

export interface SectionsTextSection extends Schema.Component {
  collectionName: 'components_sections_text_sections';
  info: {
    displayName: 'TextSection';
    icon: 'bulletList';
  };
  attributes: {
    text: Attribute.RichText;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'meta.metadata': MetaMetadata;
      'sections.text-section': SectionsTextSection;
    }
  }
}
