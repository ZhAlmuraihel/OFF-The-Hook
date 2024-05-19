import React, { useContext, useEffect, useState } from "react";
import { Card, CardBody, Col, Row } from "react-bootstrap";
import "@djthoms/pretty-checkbox";
import { Switch } from "pretty-checkbox-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { InitialContext } from "../../App";
import { getQueryParams } from "../../utils/utils";
import { toast } from "react-toastify";
import logo from "C:/Users/ZHAlm/OneDrive/Desktop/Project/Frontend/src/logo.jpeg";


function Home() {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, setSettings, emails, setEmails, token, setToken, notify } =
    useContext(InitialContext);

  const handleChange = async (e, name) => {
    const isChecked = e.target.checked;
    if (isChecked) {
      if (notify) {
        toast.info("Please wait while we are connecting");
      }
      window.location.href = `${process.env.REACT_APP_BACK_URL}/auth`;
    }
    setSettings((prevSettings) => ({
      ...prevSettings,
      [name]: !prevSettings[name],
    }));
  };

  const init = async () => {
    const response = await fetch(`${process.env.REACT_APP_BACK_URL}/emails`);
    const result = await response.json();
    if (result.status) {
      setEmails(result.data.emails);
      setToken(result.data.token);
      if (result.data?.token?.[0]) {
        setSettings((prevSettings) => ({
          ...prevSettings,
          enableTool: result.data?.token?.[0]?.isConnected,
          enableHeader: result.data?.token?.[0]?.headerAnalysis,
          enableURL: result.data?.token?.[0]?.urlScanning,
        }));
        localStorage.setItem(
          "settings",
          JSON.stringify({
            enableTool: result.data?.token?.[0]?.isConnected,
            enableHeader: result.data?.token?.[0]?.headerAnalysis,
            enableURL: result.data?.token?.[0]?.urlScanning,
            enableAttachement: true,
          })
        );
      }
    }
  };

  useEffect(() => {
    const queryParams = getQueryParams(location.search);
    if (queryParams.isConnected === "true") {
      if (notify) {
        toast.success("Connection established successfully");
      }
      localStorage.setItem("isConnected", true);
      navigate("/");
    }
  }, []);

  useEffect(() => {
    init();
    const intervalId = setInterval(() => {
      init();
    }, 10000);
    return () => clearInterval(intervalId);
  }, [settings]);

  return (
    <Row className="my-5">
      <Col lg={4}></Col>
      <Col lg={4}>
        <Card>
          <CardBody>
            <div className="text-center">
            <img src={logo} alt="Logo" className="logo" style={{ height: "5cm", width: "5cm" }}/>
              <h4>OFF-The-Hook</h4>
              <div className="d-flex mt-4 align-items-center justify-content-center gap-3">
                <label className="form-label">Enable Tool</label>
                <Switch
                  checked={settings.enableTool}
                  onChange={(e) => handleChange(e, "enableTool")}
                  color={"primary"}
                  shape="fill"
                ></Switch>
              </div>
            </div>
            <div className="mt-3">
              {emails &&
                emails?.splice(0, 3).map((e, i) => {
                  return (
                    <div className="email__card">
                      <span>
                        <span className="fw-bold">From:</span> {e.from}
                      </span>{" "}
                      <br />
                      <span>
                        <span className="fw-bold">Email Subject:</span>{" "}
                        {e.emailSubject}
                      </span>
                    </div>
                  );
                })}
            </div>
            <div className="mt-5">
              <div className="d-flex justify-content-center gap-4">
                <Link to={"/settings"} className="btn btn-dark">
                  Settings
                </Link>
                <Link to={"/help"} className="btn btn-dark">
                  Help
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      </Col>
      <Col lg={4}></Col>
    </Row>
  );
}

export default Home;
