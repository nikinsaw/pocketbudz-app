import * as React from "react"
import Svg, { Path } from "react-native-svg"
const SvgComponent = ({width, fill, ...rest}) => (
  <Svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    fill="none"
    {...rest} 
  >
    <Path fill={fill} d="M0 16.2V5.4L7.2 0l7.2 5.4v10.8H9V9.9H5.4v6.3H0Z" />
  </Svg>
)
export default SvgComponent