import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Image as NativeImage } from 'react-native';
import { Image as SvgImage } from 'react-native-svg';

class ImageLayer extends Component {
  constructor(props) {
    super(props);
    this.state = { naturalWidth: 0, naturalHeight: 0 };
    this.loadVersion = 0;
  }

  componentDidMount() { this.unmounted = false; this.getImageDimensionInfo(); }

  componentDidUpdate(prevProps) {
    if (prevProps.src !== this.props.src) this.getImageDimensionInfo();
  }

  componentWillUnmount() { this.unmounted = true; this.loadVersion += 1; }

  getImageDimensionInfo() {
    const version = ++this.loadVersion;
    this.setState({ naturalWidth: 0, naturalHeight: 0 });
    const source = typeof this.props.src === 'string' ? { uri: this.props.src } : this.props.src;
    const success = (width, height) => {
      if (this.unmounted || version !== this.loadVersion) return;
      this.setState({ naturalWidth: width, naturalHeight: height });
      this.props.onLoad({ naturalWidth: width, naturalHeight: height });
    };
    const failure = error => {
      if (!this.unmounted && version === this.loadVersion) this.props.onError(error);
    };
    try {
      const resolved = NativeImage.resolveAssetSource(source);
      if (resolved && resolved.width && resolved.height) {
        success(resolved.width, resolved.height);
      } else if (source && source.uri) {
        if (source.headers) NativeImage.getSizeWithHeaders(source.uri, source.headers, success, failure);
        else NativeImage.getSize(source.uri, success, failure);
      } else failure(new Error('ImageLayer requires a URI or a React Native image source'));
    } catch (error) { failure(error); }
  }

  render() {
    const { onLoad, onError, src, ...otherProps } = this.props;
    const { naturalHeight, naturalWidth } = this.state;
    return (
      <SvgImage
        href={typeof src === 'string' ? { uri: src } : src}
        width={naturalWidth} height={naturalHeight}
        pointerEvents="none" {...otherProps}
      />
    );
  }
}

ImageLayer.propTypes = {
  src: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object]).isRequired,
};
ImageLayer.defaultProps = { onLoad: () => {}, onError: () => {} };
export default ImageLayer;
