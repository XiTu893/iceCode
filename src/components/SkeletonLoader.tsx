import React from 'react';

export type SkeletonType = 
  | 'text'
  | 'title'
  | 'paragraph'
  | 'circle'
  | 'rect'
  | 'list'
  | 'card';

interface SkeletonLoaderProps {
  type?: SkeletonType;
  width?: string | number;
  height?: string | number;
  count?: number;
  animated?: boolean;
  className?: string;
}

/**
 * 骨架屏加载组件
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  type = 'text',
  width,
  height,
  count = 1,
  animated = true,
  className = '',
}) => {
  const items = Array.from({ length: count });

  return (
    <div className={`skeleton-loader ${className}`}>
      {items.map((_, index) => (
        <SkeletonItem
          key={index}
          type={type}
          width={width}
          height={height}
          animated={animated}
          isLast={index === items.length - 1}
        />
      ))}
    </div>
  );
};

/**
 * 单个骨架项
 */
interface SkeletonItemProps {
  type: SkeletonType;
  width?: string | number;
  height?: string | number;
  animated: boolean;
  isLast: boolean;
}

const SkeletonItem: React.FC<SkeletonItemProps> = ({
  type,
  width,
  height,
  animated,
  isLast,
}) => {
  const style = getStyle(type, width, height);

  return (
    <div
      className={`skeleton-item skeleton-${type} ${animated ? 'animated' : ''} ${isLast ? 'last' : ''}`}
      style={style}
    />
  );
};

/**
 * 获取样式
 */
function getStyle(
  type: SkeletonType,
  width?: string | number,
  height?: string | number
): React.CSSProperties {
  const baseStyle: React.CSSProperties = {};

  if (width) {
    baseStyle.width = typeof width === 'number' ? `${width}px` : width;
  }

  if (height) {
    baseStyle.height = typeof height === 'number' ? `${height}px` : height;
  }

  // 默认尺寸
  switch (type) {
    case 'text':
      if (!baseStyle.width) baseStyle.width = '60%';
      if (!baseStyle.height) baseStyle.height = '16px';
      break;
    case 'title':
      if (!baseStyle.width) baseStyle.width = '40%';
      if (!baseStyle.height) baseStyle.height = '24px';
      break;
    case 'paragraph':
      if (!baseStyle.width) baseStyle.width = '100%';
      if (!baseStyle.height) baseStyle.height = '60px';
      break;
    case 'circle':
      if (!baseStyle.width) baseStyle.width = '40px';
      if (!baseStyle.height) baseStyle.height = '40px';
      baseStyle.borderRadius = '50%';
      break;
    case 'rect':
      if (!baseStyle.width) baseStyle.width = '100%';
      if (!baseStyle.height) baseStyle.height = '120px';
      break;
    case 'list':
      if (!baseStyle.width) baseStyle.width = '100%';
      if (!baseStyle.height) baseStyle.height = '40px';
      break;
    case 'card':
      if (!baseStyle.width) baseStyle.width = '100%';
      if (!baseStyle.height) baseStyle.height = '200px';
      break;
  }

  return baseStyle;
}

/**
 * 预设的骨架屏组合
 */

export const TextSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="skeleton-preset">
    <SkeletonLoader type="title" />
    <SkeletonLoader type="text" count={lines} />
  </div>
);

export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 5 }) => (
  <div className="skeleton-preset">
    <SkeletonLoader type="list" count={items} />
  </div>
);

export const CardSkeleton: React.FC<{ cards?: number }> = ({ cards = 3 }) => (
  <div className="skeleton-preset card-grid">
    <SkeletonLoader type="card" count={cards} />
  </div>
);

export const AvatarListSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="skeleton-preset avatar-list">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="avatar-item">
        <SkeletonLoader type="circle" width={40} height={40} />
        <SkeletonLoader type="text" width={80} />
      </div>
    ))}
  </div>
);

export default SkeletonLoader;
