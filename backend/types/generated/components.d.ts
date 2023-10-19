import type { Schema, Attribute } from '@strapi/strapi';

export interface ElementsAnchor extends Schema.Component {
  collectionName: 'components_elements_anchors';
  info: {
    displayName: 'Anchor';
    icon: 'link';
    description: '';
  };
  attributes: {
    href: Attribute.String;
    newTab: Attribute.Boolean & Attribute.DefaultTo<false>;
  };
}

export interface ElementsButton extends Schema.Component {
  collectionName: 'components_elements_buttons';
  info: {
    displayName: 'Button';
    description: '';
  };
  attributes: {
    text: Attribute.String;
    type: Attribute.Enumeration<['primary', 'secondary', 'text']>;
    arrow: Attribute.Boolean & Attribute.DefaultTo<false>;
    link: Attribute.Component<'elements.anchor'>;
  };
}

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

export interface SectionsHeroSection extends Schema.Component {
  collectionName: 'components_sections_hero_sections';
  info: {
    displayName: 'HeroSection';
    description: '';
  };
  attributes: {
    title: Attribute.String;
    subtitle: Attribute.String;
    buttons: Attribute.Component<'elements.button', true>;
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
      'elements.anchor': ElementsAnchor;
      'elements.button': ElementsButton;
      'meta.metadata': MetaMetadata;
      'sections.hero-section': SectionsHeroSection;
      'sections.text-section': SectionsTextSection;
    }
  }
}
