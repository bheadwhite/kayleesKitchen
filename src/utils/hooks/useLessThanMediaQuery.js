import useMediaQuery from "@material-ui/core/useMediaQuery"

const useLessThanMediaQuery = (lessThanAmount) => {
  return useMediaQuery(`(max-width:${lessThanAmount}`)
}

export default useLessThanMediaQuery
