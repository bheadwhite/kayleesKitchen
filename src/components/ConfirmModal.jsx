import React from "react"
import _ from "lodash"
import theme from "theme"
import { MuiThemeProvider, Dialog } from "@material-ui/core"
import { Warning } from "@material-ui/icons"
import ReactDOM from "react-dom"

const containerDiv = document.createElement("div")

document.body.appendChild(containerDiv)

const close = () => {
  ReactDOM.render(<React.Fragment />, containerDiv)
}

export const ConfirmModal = (props) => {
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

  const { title, body, cancelText, okText, icon, isAlert } = props
  return (
    <MuiThemeProvider theme={theme}>
      <Dialog
        id='confirm-dialog'
        onClose={handleCancel}
        open
        okText={okText ? okText : "Ok"}
        onOkClick={handleConfirm}
        cancelText={cancelText}
        title={title}
        titleIcon={icon || <Warning />}
        isAlert={isAlert}>
        {!_.isString(body) ? body : <p>{body}</p>}
      </Dialog>
    </MuiThemeProvider>
  )
}

export const confirm = (props) => {
  ReactDOM.render(<ConfirmModal cancelText='Cancel' {...props} />, containerDiv)
}

export const alert = (props) => {
  ReactDOM.render(<ConfirmModal isAlert {...props} />, containerDiv)
}
