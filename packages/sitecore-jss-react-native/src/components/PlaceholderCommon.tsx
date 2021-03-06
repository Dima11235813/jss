import React from 'react';
import PropTypes from 'prop-types';
import { MissingComponent } from './MissingComponent';
import { ComponentFactory } from './sharedTypes';
import {
  ComponentRendering,
  RouteData,
  Field,
  Item,
  HtmlElementRendering,
} from '@sitecore-jss/sitecore-jss';
import { UnrenderableComponent } from './UnrenderableComponent';

export interface PlaceholderProps {
  /** Name of the placeholder to render. */
  name: string;
  /** Rendering data to be used when rendering the placeholder. */
  rendering: ComponentRendering | RouteData;
  /**
   * A factory function that will receive a componentName and return an instance of a React component.
   * When rendered within a <SitecoreContext> component, defaults to the context componentFactory.
   */
  componentFactory?: ComponentFactory | null;
  /**
   * An object of field names/values that are aggregated and propagated through the component tree created by a placeholder.
   * Any component or placeholder rendered by a placeholder will have access to this data via `props.fields`.
   */
  fields?: {
    [name: string]: Field | Item[];
  } | null;
  /**
   * An object of rendering parameter names/values that are aggregated and propagated through the component tree created by a placeholder.
   * Any component or placeholder rendered by a placeholder will have access to this data via `props.params`.
   */
  params?: {
    [name: string]: string;
  } | null;

  /**
   * A component that is rendered in place of any components that are in this placeholder,
   * but do not have a definition in the componentFactory (i.e. don't have a React implementation)
   */
  missingComponentComponent?: React.ComponentClass<any> | React.SFC<any> | null;

  /**
   * A component that is rendered in place of the placeholder when an error occurs rendering
   * the placeholder
   */
  errorComponent?: React.ComponentClass<any> | React.SFC<any> | null;

  /**
   * A component that is rendered in place of any components that are in this placeholder,
   * but are not renderable by react-native (i.e. DOM elements)
   */
  unrenderableComponentComponent?: React.ComponentClass<any> | React.SFC<any> | null;

  [key: string]: any;
}

export class PlaceholderCommon extends React.Component<PlaceholderProps> {
  static propTypes = {
    name: PropTypes.string.isRequired,
    componentFactory: PropTypes.func,
    rendering: PropTypes.any.isRequired,
    fields: PropTypes.any,
    params: PropTypes.any,
    missingComponentComponent: PropTypes.any,
    errorComponent: PropTypes.any,
    unrenderableComponentComponent: PropTypes.any,
  };

  nodeRefs: any[];
  state: Readonly<{ error?: Error }>;

  static getPlaceholderDataFromRenderingData(
    rendering: ComponentRendering | RouteData,
    name: string
  ) {
    let result;
    if (rendering && rendering.placeholders && Object.keys(rendering.placeholders).length > 0) {
      result = rendering.placeholders[name];
    } else {
      result = null;
    }

    if (!result) {
      console.warn(
        `Placeholder '${name}' was not found in the current rendering data`,
        JSON.stringify(rendering, null, 2)
      );

      return [];
    }

    return result;
  }

  constructor(props: PlaceholderProps) {
    super(props);
    this.nodeRefs = [];
    this.state = {};
  }

  componentDidCatch(error: Error) {
    this.setState({ error });
  }

  getComponentsForRenderingData(
    placeholderData: (ComponentRendering | HtmlElementRendering)[] | null
  ) {
    const {
      name,
      fields: placeholderFields,
      params: placeholderParams,
      unrenderableComponentComponent,
      missingComponentComponent,
      ...placeholderProps
    } = this.props;

    return (
      placeholderData &&
      placeholderData
        .map((rendering: any, index: number) => {
          const key = rendering.uid ? rendering.uid : `component-${index}`;
          const commonProps = { key };

          let component: React.ReactNode | null;
          // if the element is not a 'component rendering', we can't render it 'raw' like with react-dom
          // register a warning instead.
          if (!rendering.componentName && rendering.name) {
            console.error(
              `Placeholder ${name} contains a rendering that cannot be rendered in React Native '${
                rendering.name
              }'. This is likely the result of including Experience Editor output in rendering data
            or using non-JSON renderings in an item's presentation details / layout. React Native
            is not able to render DOM elements, your Sitecore renderings must map to React components
            defined in your componentFactory.js.`
            );
            component = unrenderableComponentComponent || UnrenderableComponent;
          }

          if (!component) {
            component = this.getComponentForRendering(rendering);
            if (!component) {
              console.error(
                `Placeholder ${name} contains unknown component ${
                  rendering.componentName
                }. Ensure that a React component exists for it, and that it is registered in your componentFactory.js.`
              );

              component = missingComponentComponent || MissingComponent;
            }
          }

          const finalProps = {
            ...commonProps,
            ...placeholderProps,
            ...((placeholderFields || rendering.fields) && {
              fields: { ...placeholderFields, ...rendering.fields },
            }),
            ...((placeholderParams || rendering.params) && {
              params: { ...placeholderParams, ...rendering.params },
            }),
            rendering,
          };

          return React.createElement(component as any, finalProps);
        })
        .filter((element: any) => element)
    ); // remove nulls
  }

  getComponentForRendering(renderingDefinition: { componentName: string }) {
    const componentFactory = this.props.componentFactory;

    if (!componentFactory || typeof componentFactory !== 'function') {
      console.warn(
        `No componentFactory was available to service request for component ${renderingDefinition}`
      );
      return null;
    }

    return componentFactory(renderingDefinition.componentName);
  }
}
