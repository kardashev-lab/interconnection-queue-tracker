declare module "react-simple-maps" {
  import type { CSSProperties, ReactNode } from "react";

  export interface GeographyFeature {
    rsmKey: string;
    id?: string | number;
    properties: Record<string, unknown>;
    [key: string]: unknown;
  }

  export interface ComposableMapProps {
    projection?: string;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: ReactNode;
    "aria-label"?: string;
  }

  export interface GeographiesProps {
    geography: string | object;
    children: (data: { geographies: GeographyFeature[] }) => ReactNode;
  }

  export interface GeographyProps {
    geography: GeographyFeature;
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeWidth?: number;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    style?: {
      default?: CSSProperties;
      hover?: CSSProperties;
      pressed?: CSSProperties;
    };
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
}
