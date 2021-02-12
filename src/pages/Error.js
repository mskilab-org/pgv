import React, {Component} from 'react';
import {Link} from "react-router-dom";

class Error extends Component {

    render() {
        return (
            <main className="error-page">
                <section className="error-area padding-top-140px">
                    <div className="error-shape"></div>
                    <div className="error-actions">
                        <ul>
                            <li><Link to="/">Back to Home</Link></li>
                        </ul>
                    </div>
                </section>
            </main>
        );
    }
}

export default Error;