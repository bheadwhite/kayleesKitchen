import React from "react"
import _ from "lodash"
import theme from "theme"
import { MuiThemeProvider, Dialog } from "@material-ui/core"
import { Warning } from "@material-ui/icons"
import { Button } from "components"
import ReactDOM from "react-dom"
import { makeStyles } from "@material-ui/core"

const useStyles = makeStyles((theme) => ({
  container: {
    padding: theme.spacing(1.5),
  },
}))
const containerDiv = document.createElement("div")

document.body.appendChild(containerDiv)

const close = () => {
  ReactDOM.render(<React.Fragment />, containerDiv)
}

interface IProps {
  title?: string
  body?: string
  canceltext?: string
  oktext?: string
  icon?: JSX.Element | null
  onCancel?: () => void
  onConfirm?: () => void
  children?: React.ReactNode
}

export const ConfirmModal = ({
  title,
  body,
  canceltext,
  oktext,
  icon,
  ...props
}: IProps) => {
  const classes = useStyles()
  const handleCancel = () => {
    close()
    if (props.onCancel) {
      props.onCancel()
    }
  }

  const handleConfirm = () => {
    close()
    if (props.onConfirm) {
      props.onConfirm()
    }
  }
  return (
    <MuiThemeProvider theme={theme}>
      <Dialog open id='confirm-dialog' onClose={handleCancel} title={title}>
        <div className={classes.container}>
          <Warning />
          {!_.isString(body) ? body : <p>{body}</p>}
          <Button
            style={{ marginRight: theme.spacing(1) }}
            onClick={handleCancel}>
            No
          </Button>
          <Button onClick={handleConfirm}>Yes</Button>
        </div>
      </Dialog>
    </MuiThemeProvider>
  )
}

export const confirm = (props: any) => {
  ReactDOM.render(<ConfirmModal {...props} />, containerDiv)
}
