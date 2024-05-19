import React, { useState } from "react";
import { Card, CardBody, Col, Row } from "react-bootstrap";
import { IoMdArrowRoundBack } from "react-icons/io";
import { Link } from "react-router-dom";

function Help() {
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
              <h5 className="fs-4">Help</h5>
              <hr />
              <div className="content-left">
                <h6> About OFF-The-Hook: </h6>
                <p className="text-muted">
                OFF-The-Hook offers users robust protection against Zero-Font and general phishing attacks.
                </p>
              </div>
              <div className="content-left">
              <h6>What does Help Interface Provide?</h6>
              <p className="text-muted">Assisting Users with Knowledge Needed to Use OFF-The-Hook, Q&As, and Future Updates.</p>
              </div>
              <div className="content-left">
              <h6>What does Setting Interface Provide?</h6>
              <p className="text-muted">Allows Users to Customize Thier Preferences: Enable/Disable Notification and Scanning Controls.</p>
              </div>
              <div className="content-left">
              <h6>A Sneak Peek into the Future: What Can You Expect in Upcoming Versions?</h6>
            <ul className="text-muted">
            <li>OFF-The-Hook as an Add-on.</li>
            <li>Shortcuts for Interfaces.</li>
            <li>Clarification: Reasons Behind Classifying the Email as Phishing.</li>
            </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      </Col>
      <Col lg={4}></Col>
    </Row>
  );
}

export default Help;
