import React, { useContext, useEffect, useState } from "react";
import { Card, CardBody, Col, Row } from "react-bootstrap";
import "@djthoms/pretty-checkbox";
import { Switch } from "pretty-checkbox-react";
import { IoMdArrowRoundBack } from "react-icons/io";
import { Link } from "react-router-dom";
import { InitialContext } from "../../App";
import { toast } from "react-toastify";

function Settings() {
  const { settings, setSettings, notify, setNotify } =
    useContext(InitialContext);

  const changeHandler = async (headerAnalysis, urlScanning) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACK_URL}/update-settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            headerAnalysis,
            urlScanning,
          }),
        }
      );
      localStorage.setItem(
        "settings",
        JSON.stringify({
          enableTool: localStorage.getItem("isConnected") || false,
          enableHeader: headerAnalysis,
          enableAttachement: true,
          enableURL: urlScanning,
        })
      );
      if (response.status == 400) {
        if (notify) {
          toast.warning("Connect with Outlook first");
        }
        localStorage.setItem("isConnected", false);
        throw new Error("Network response was not ok " + response.statusText);
      }

      const result = await response.json();

      if (notify) {
        toast.success("Settings updated successfully");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleChange = (name) => {
    setSettings((prevSettings) => ({
      ...prevSettings,
      [name]: !prevSettings[name],
    }));
  };

  return (
    <Row className="my-5">
      <Col lg={4}></Col>
      <Col lg={4}>
        <Card className="mx-4">
          <CardBody className="mx-5">
            <Link to={"/"}>
              <IoMdArrowRoundBack className="fs-2 cp text-dark" />
            </Link>
            <div className="text-center">
              <h5 className="fs-4">Settings</h5>
              <hr />
              <div>
                <p className="text-muted">
                  Allow OFF-The-Hook to send you notification of emails
                  classified as phishing:
                </p>
              </div>
              <div className="d-flex mt-4 align-items-center justify-content-center gap-3">
                <label className="form-label">Enable notifications</label>
                <Switch
                  checked={notify}
                  onChange={(e) => {
                    setNotify(e.target.checked);
                    localStorage.setItem("notify", e.target.checked);
                  }}
                  color={"primary"}
                  shape="fill"
                ></Switch>
              </div>
              <hr />
              <div className="mt-5">
                <p className="text-muted">
                  Enable/Disable what component that will be scanned for
                  detecting phishing
                </p>
              </div>
            </div>
            <div className="d-flex mt-4 align-items-center justify-content-center gap-3">
              <label className="form-label">Enable Header scanning</label>
              <Switch
                checked={settings.enableHeader}
                onChange={(e) => {
                  handleChange("enableHeader");
                  changeHandler(e.target.checked, settings.enableURL);
                }}
                color={"primary"}
                shape="fill"
              ></Switch>
            </div>
            {/* <div className="d-flex mt-4 align-items-center justify-content-center gap-3">
              <label className="form-label">Enable Attachement scanning</label>
              <Switch
                checked={settings.enableAttachement}
                onChange={() => handleChange("enableAttachement")}
                color={"primary"}
                shape="fill"
              ></Switch>
            </div> */}
            <div className="d-flex mt-4 align-items-center justify-content-center gap-3">
              <label className="form-label">Enable URL scanning</label>
              <Switch
                checked={settings.enableURL}
                onChange={(e) => {
                  handleChange("enableURL");
                  changeHandler(settings.enableHeader, e.target.checked);
                }}
                color={"primary"}
                shape="fill"
              ></Switch>
            </div>
          </CardBody>
        </Card>
      </Col>
      <Col lg={4}></Col>
    </Row>
  );
}

export default Settings;
